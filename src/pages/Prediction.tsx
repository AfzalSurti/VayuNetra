import { useMemo, useState } from 'react';
import { useData } from '../store';
import { TrackMap, ImdLegend } from '../components/TrackMap';
import { Badge, Card, DataSources, Select, Unavailable, fmtTime } from '../components/ui';
import { DatasetGate } from '../components/DatasetGate';
import { StormPanel } from '../components/StormPanel';
import { forecast, synopticFixes } from '../lib/ml';
import { gcDistanceKm } from '../lib/geo';

export default function Prediction() {
  const { ni, active, model } = useData();
  const m = model.model;
  const candidates = useMemo(() => [...active.storms, ...ni.storms.filter((s) => (s.maxWindKt ?? 0) >= 34 && synopticFixes(s).length >= 3)], [ni.storms, active.storms]);
  const [sid, setSid] = useState('');
  const storm = candidates.find((s) => s.sid === sid) ?? candidates[0] ?? null;
  const fixes = storm ? synopticFixes(storm) : [];
  const [idx, setIdx] = useState<number | null>(null);
  const i = idx != null && idx < fixes.length ? idx : Math.max(2, fixes.length - 1);
  const basisT = fixes[i]?.t;
  const fc = m && storm ? forecast(m, storm, basisT) : null;
  const inTest = m && storm ? storm.season >= m.split.test[0] : false;

  return (
    <div className="space-y-3">
      <DatasetGate ds={ni}>
        {!m ? <Unavailable title={model.status === 'training' ? 'Model training in progress…' : 'Model unavailable'} reason={model.reason ?? 'Training on official IMD best-track data is running in your browser.'} /> : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <Select label="Cyclone (≥ CS, or active)" value={storm?.sid ?? ''} onChange={(v) => { setSid(v); setIdx(null); }}
                options={candidates.map((s) => ({ value: s.sid, label: `${s.season} · ${s.name} · ${s.subbasin} · ${s.maxWindKt} kt${active.storms.includes(s) ? ' · ACTIVE' : ''}` }))} />
              {fixes.length > 2 && (
                <label className="flex min-w-72 flex-col gap-1 text-[11px] uppercase tracking-wider text-slate-500">Forecast issued from fix: {fmtTime(fixes[i]?.time)}
                  <input type="range" min={2} max={fixes.length - 1} value={i} onChange={(e) => setIdx(Number(e.target.value))} />
                </label>
              )}
              {storm && <div className="text-xs text-slate-400">{inTest ? <Badge tag="ml" label="Held-out test season" /> : <Badge tag="unavailable" label="Season used in training — hindcast is in-sample" />}</div>}
            </div>
            <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
              <Card title="Observed (official) vs. AI/ML predicted track" right={<ImdLegend />}>
                {storm && <TrackMap selected={storm} forecast={fc && 'points' in fc ? fc.points : undefined} basis={fc && 'basis' in fc ? fc.basis : null} className="h-[540px]" />}
              </Card>
              <div className="space-y-3">
                <Card title="Observation at forecast time">{storm && <StormPanel storm={storm} at={fixes[i]} sourceLabel="RSMC New Delhi via IBTrACS" />}</Card>
                <Card title="Model" right={<Badge tag="ml" />}>
                  <div className="space-y-1 text-xs text-slate-300">
                    <div>Version: <span className="font-mono">{m.version}</span></div>
                    <div>Type: ridge regression, direct multi-horizon (track Δlat/Δlon + intensity)</div>
                    <div>Trained: {fmtTime(m.trainedAt)} (in browser) on {m.nSamples} samples</div>
                    <div>Split: train {m.split.train.join('–')} · val {m.split.val.join('–')} · test {m.split.test.join('–')}</div>
                    <div>Uncertainty: circles = 90th-percentile track error on the test seasons.</div>
                  </div>
                </Card>
              </div>
            </div>
            <Card title="Forecast table" right={<Badge tag="ml" />}>
              {fc && 'error' in fc ? <Unavailable title="Prediction unavailable" reason={fc.error} /> : fc && (
                <table className="num w-full text-left text-xs">
                  <thead className="text-slate-500"><tr><th className="py-1">Horizon</th><th>Valid time</th><th>Predicted position</th><th>Predicted wind</th><th>90% error radius</th><th>Official obs. at valid time</th><th>Track error</th><th>Wind error</th></tr></thead>
                  <tbody>{fc.points.map((p) => {
                    const o = storm!.points.find((q) => q.t === Date.parse(p.time) && q.posSource === 'NEWDELHI');
                    return (
                      <tr key={p.horizon} className="border-t border-slate-800">
                        <td className="py-1">+{p.horizon} h</td><td>{fmtTime(p.time)}</td><td>{p.lat.toFixed(2)}, {p.lon.toFixed(2)}</td><td>{p.windKt.toFixed(0)} kt</td><td>{p.errRadiusKm.toFixed(0)} km</td>
                        <td>{o ? `${o.lat.toFixed(2)}, ${o.lon.toFixed(2)} · ${o.windKt ?? '—'} kt` : 'no official fix'}</td>
                        <td>{o ? `${gcDistanceKm(p.lat, p.lon, o.lat, o.lon).toFixed(0)} km` : '—'}</td>
                        <td>{o?.windKt != null ? `${(p.windKt - o.windKt).toFixed(0)} kt` : '—'}</td>
                      </tr>);
                  })}</tbody>
                </table>
              )}
            </Card>
          </>
        )}
      </DatasetGate>
      <DataSources rows={[
        { source: 'IBTrACS v04r01 – RSMC New Delhi columns', product: 'Training & inference input', url: ni.officialUrl, retrieved: fmtTime(ni.retrievedAt), coverage: 'North Indian Ocean', status: <Badge tag="official" /> },
        { source: 'VayuNetra in-browser model', product: m?.version ?? 'none', observation: m ? fmtTime(m.trainedAt) : undefined, status: m ? <Badge tag="ml" /> : <Badge tag="unavailable" label="Model unavailable" /> },
      ]} />
    </div>
  );
}
