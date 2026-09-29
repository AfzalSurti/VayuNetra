import { useMemo, useState } from 'react';
import { useData } from '../store';
import { TrackMap, ImdLegend } from '../components/TrackMap';
import { Badge, Card, DataSources, fmtTime, Select } from '../components/ui';
import { DatasetGate } from '../components/DatasetGate';
import { StormPanel } from '../components/StormPanel';
import { imdClass, IMD_SCALE } from '../lib/geo';

export default function Explorer() {
  const { ni } = useData();
  const seasons = useMemo(() => [...new Set(ni.storms.map((s) => s.season))].sort((a, b) => b - a), [ni.storms]);
  const [season, setSeason] = useState('');
  const [basin, setBasin] = useState<'all' | 'AS' | 'BB'>('all');
  const [minGrade, setMinGrade] = useState('D');
  const [q, setQ] = useState('');
  const [sid, setSid] = useState<string | null>(null);
  const yr = season || String(seasons[0] ?? '');
  const minWind = IMD_SCALE.find((s) => s.code === minGrade)!.min;

  const list = useMemo(() => ni.storms.filter((s) =>
    (q ? s.name.toLowerCase().includes(q.toLowerCase()) : String(s.season) === yr)
    && (basin === 'all' || s.subbasin === basin)
    && (s.maxWindKt ?? -1) >= minWind), [ni.storms, yr, basin, minWind, q]);
  const sel = list.find((s) => s.sid === sid) ?? list[0] ?? null;

  return (
    <div className="space-y-3">
      <DatasetGate ds={ni}>
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Season" value={yr} onChange={(v) => { setSeason(v); setQ(''); }} options={seasons.map((s) => ({ value: String(s), label: String(s) }))} />
          <Select label="Genesis basin" value={basin} onChange={setBasin} options={[{ value: 'all', label: 'All NIO' }, { value: 'AS', label: 'Arabian Sea' }, { value: 'BB', label: 'Bay of Bengal' }]} />
          <Select label="Min. peak grade (IMD)" value={minGrade} onChange={setMinGrade} options={IMD_SCALE.slice(1).map((s) => ({ value: s.code, label: `${s.code} (≥${s.min} kt)` }))} />
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-slate-500">Search name (all years)
            <input className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. storm name" />
          </label>
          <div className="text-xs text-slate-500">{list.length} systems match</div>
        </div>
        <div className="grid gap-3 xl:grid-cols-[260px_1fr_360px]">
          <Card title="Systems" className="max-h-[560px] overflow-y-auto">
            {list.length === 0 && <div className="text-sm text-slate-500">No official records match the filter.</div>}
            {list.map((s) => (
              <button key={s.sid} onClick={() => setSid(s.sid)} className={`mb-1 block w-full rounded px-2 py-1 text-left text-sm ${sel?.sid === s.sid ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}>
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: imdClass(s.maxWindKt)?.color ?? '#475569' }} />
                {s.name} <span className="text-xs text-slate-500">{s.start.slice(0, 10)} · {s.subbasin} · {s.maxWindKt ?? '—'} kt</span>
              </button>
            ))}
          </Card>
          <Card title="Track map" right={<ImdLegend />}>
            <TrackMap storms={list} selected={sel} onSelect={(s) => setSid(s.sid)} className="h-[520px]" />
          </Card>
          <Card title="Cyclone information">{sel ? <StormPanel storm={sel} sourceLabel="RSMC New Delhi best track via IBTrACS v04r01" /> : <div className="text-sm text-slate-500">Select a system.</div>}</Card>
        </div>
        {sel && (
          <Card title={`Observed track — ${sel.name} (${sel.points.length} fixes)`} right={<Badge tag="official" />}>
            <div className="max-h-72 overflow-auto">
              <table className="num w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900 text-slate-500"><tr><th className="py-1">Time (UTC)</th><th>Lat</th><th>Lon</th><th>Wind (kt)</th><th>Pressure (hPa)</th><th>IMD grade</th><th>Nature</th><th>Dist. to land (km)</th><th>Position source</th></tr></thead>
                <tbody>{sel.points.map((p) => (
                  <tr key={p.t} className="border-t border-slate-800"><td className="py-0.5">{fmtTime(p.time)}</td><td>{p.lat.toFixed(2)}</td><td>{p.lon.toFixed(2)}</td><td>{p.windKt ?? '—'}</td><td>{p.presHpa ?? '—'}</td><td>{p.grade ?? '—'}</td><td>{p.nature}</td><td>{p.distToLandKm ?? '—'}</td><td>{p.posSource === 'NEWDELHI' ? 'RSMC New Delhi' : 'IBTrACS combined'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
        )}
      </DatasetGate>
      <DataSources rows={[{ source: 'NOAA NCEI – IBTrACS v04r01 (NEWDELHI_* = IMD / RSMC New Delhi)', product: 'ibtracs.NI.list.v04r01.csv', url: ni.officialUrl, observation: sel ? `${fmtTime(sel.start)} → ${fmtTime(sel.end)}` : undefined, retrieved: fmtTime(ni.retrievedAt), coverage: 'North Indian Ocean', status: ni.status === 'ok' ? <Badge tag="official" /> : <Badge tag="unavailable" label={ni.status} /> }]} />
    </div>
  );
}
