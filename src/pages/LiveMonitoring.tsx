import { useEffect, useState } from 'react';
import { useData } from '../store';
import { TrackMap, ImdLegend } from '../components/TrackMap';
import { Badge, Card, DataSources, Unavailable, fmtNum, fmtTime } from '../components/ui';
import { DatasetGate } from '../components/DatasetGate';
import { StormPanel } from '../components/StormPanel';
import type { Storm } from '../lib/ibtracs';
import { GIBS_LAYERS, utcDate } from '../lib/gibs';
import { pointEnvironment, type PointEnv } from '../lib/openmeteo';
import { forecast } from '../lib/ml';

export default function LiveMonitoring() {
  const { active, model } = useData();
  const [sel, setSel] = useState<Storm | null>(null);
  const [env, setEnv] = useState<PointEnv | null>(null);
  const [layerId, setLayerId] = useState(GIBS_LAYERS[2].id);
  const storm = sel ?? active.storms[0] ?? null;
  const last = storm?.points[storm.points.length - 1];
  const layer = GIBS_LAYERS.find((l) => l.id === layerId)!;
  const date = utcDate(-1);
  const fc = storm && model.model ? forecast(model.model, storm) : null;

  useEffect(() => {
    setEnv(null);
    if (last) pointEnvironment(last.lat, last.lon).then(setEnv);
  }, [last?.lat, last?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <Unavailable tag="auth" title="INSAT-3D/3DR/3DS near-real-time imagery not connected" reason="MOSDAC requires an authenticated account; this frontend-only prototype cannot hold credentials. The latest satellite context below uses external NASA GIBS daily imagery (previous UTC day), which is not real-time." />
      <DatasetGate ds={active} label="IBTrACS ACTIVE storms feed">
        {active.storms.length === 0 ? (
          <Unavailable title="No active North Indian Ocean system" reason={`No official observation available: the IBTrACS ACTIVE feed retrieved at ${fmtTime(active.retrievedAt)} contains no system in the North Indian basin.`} />
        ) : (
          <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
            <Card title="Active systems" right={
              <select className="rounded border border-slate-700 bg-slate-950 px-1 text-xs" value={layerId} onChange={(e) => setLayerId(e.target.value)}>
                {GIBS_LAYERS.map((l) => <option key={l.id} value={l.id}>{l.satellite} · {l.product}</option>)}
              </select>}>
              <TrackMap storms={active.storms} selected={storm} onSelect={setSel} overlay={{ layer, date }} forecast={fc && 'points' in fc ? fc.points : undefined} basis={fc && 'basis' in fc ? fc.basis : null} className="h-[540px]" />
              <div className="mt-2"><ImdLegend /></div>
            </Card>
            <div className="space-y-3">
              <Card title="Latest official fix">{storm && <StormPanel storm={storm} sourceLabel="IBTrACS ACTIVE (provisional; RSMC New Delhi columns where present)" />}</Card>
              <Card title="Environment at storm centre" right={<Badge tag="external" label="External model – not observation" />}>
                {!env ? <div className="text-sm text-slate-500">Retrieving…</div> : (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Sea-surface temperature</span><span className="num">{fmtNum(env.sstC, 1, ' °C')}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">10 m wind (model grid)</span><span className="num">{fmtNum(env.wind10mKt, 0, ' kt')}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">MSL pressure (model grid)</span><span className="num">{fmtNum(env.pmslHpa, 0, ' hPa')}</span></div>
                    <div className="text-[11px] text-slate-500">Valid {fmtTime(env.validTime ?? undefined)} · retrieved {fmtTime(env.retrievedAt)} · Open-Meteo</div>
                    {env.errors.map((e) => <div key={e} className="text-[11px] text-red-300">{e}</div>)}
                  </div>
                )}
              </Card>
              <Card title="AI/ML track forecast" right={<Badge tag="ml" />}>
                {!model.model ? <Unavailable title="Model unavailable" reason={model.reason ?? 'Model is training or not available.'} />
                  : fc && 'error' in fc ? <Unavailable title="Prediction unavailable" reason={fc.error} />
                  : fc && <table className="w-full text-xs num"><tbody>{fc.points.map((p) => <tr key={p.horizon} className="border-t border-slate-800"><td className="py-1">+{p.horizon} h</td><td>{fmtTime(p.time)}</td><td>{p.lat.toFixed(1)}, {p.lon.toFixed(1)}</td><td>{p.windKt.toFixed(0)} kt</td><td>±{p.errRadiusKm.toFixed(0)} km</td></tr>)}</tbody></table>}
              </Card>
            </div>
          </div>
        )}
      </DatasetGate>
      <DataSources rows={[
        { source: 'NOAA NCEI – IBTrACS v04r01', product: 'ibtracs.ACTIVE.list.v04r01.csv', url: active.officialUrl, observation: storm ? fmtTime(last?.time) : undefined, retrieved: fmtTime(active.retrievedAt), coverage: 'Basin NI', status: active.status === 'ok' ? <Badge tag="official" label="Official (provisional)" /> : <Badge tag="unavailable" label={active.status} /> },
        { source: 'NASA GIBS', product: `${layer.id}`, url: 'https://gibs.earthdata.nasa.gov/', observation: date, coverage: 'Global tiles', status: <Badge tag="external" /> },
        { source: 'Open-Meteo', product: 'Marine API sea_surface_temperature; Forecast API wind_speed_10m, pressure_msl', url: 'https://open-meteo.com/en/docs', observation: env?.validTime ? fmtTime(env.validTime) : undefined, retrieved: fmtTime(env?.retrievedAt), coverage: 'Point at storm centre', status: <Badge tag="external" label="External model" /> },
        { source: 'MOSDAC – SAC/ISRO', product: 'INSAT-3D/3DR/3DS', url: 'https://www.mosdac.gov.in/', status: <Badge tag="auth" /> },
      ]} />
    </div>
  );
}
