import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../store';
import { Badge, Card, DataSources, Select, Stat, Unavailable, fmtTime } from '../components/ui';
import { DatasetGate } from '../components/DatasetGate';
import { TrackMap, ImdLegend } from '../components/TrackMap';
import { IMD_SCALE, imdClass } from '../lib/geo';
import { imdPoints } from '../lib/ibtracs';

const axis = { stroke: '#64748b', fontSize: 11 };
const tip = { contentStyle: { background: '#0f172a', border: '1px solid #334155', fontSize: 12 } };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Historical() {
  const { ni } = useData();
  const allSeasons = useMemo(() => [...new Set(ni.storms.map((s) => s.season))].sort((a, b) => a - b), [ni.storms]);
  const [from, setFrom] = useState('1990');
  const storms = useMemo(() => ni.storms.filter((s) => s.season >= Number(from) && s.maxWindKt != null && s.maxWindKt >= 17), [ni.storms, from]);

  const a = useMemo(() => {
    const perYear = new Map<number, { season: number; systems: number; cs: number; severe: number }>();
    const months = MONTHS.map((m) => ({ month: m, AS: 0, BB: 0 }));
    const dist = IMD_SCALE.slice(1).map((c) => ({ grade: c.code, AS: 0, BB: 0 }));
    const basin = { AS: { n: 0, wind: 0, cs: 0, hours: 0 }, BB: { n: 0, wind: 0, cs: 0, hours: 0 } };
    const ri: { name: string; season: number; sid: string; start: string; from: number; to: number; basin: string }[] = [];
    for (const s of storms) {
      const y = perYear.get(s.season) ?? { season: s.season, systems: 0, cs: 0, severe: 0 };
      y.systems++; if (s.maxWindKt! >= 34) y.cs++; if (s.maxWindKt! >= 48) y.severe++;
      perYear.set(s.season, y);
      const b = s.subbasin === 'AS' || s.subbasin === 'BB' ? s.subbasin : null;
      if (!b) continue;
      months[new Date(s.start).getUTCMonth()][b]++;
      const g = dist.find((d) => d.grade === imdClass(s.maxWindKt)!.code); if (g) g[b]++;
      basin[b].n++; basin[b].wind += s.maxWindKt!; if (s.maxWindKt! >= 34) basin[b].cs++;
      basin[b].hours += (Date.parse(s.end) - Date.parse(s.start)) / 3600e3;
      // Rapid intensification: ≥ 30 kt increase within 24 h (IMD fixes)
      const pts = imdPoints(s).filter((p) => p.windKt != null);
      const byT = new Map(pts.map((p) => [p.t, p]));
      let best: (typeof ri)[number] | null = null;
      for (const p of pts) {
        const q = byT.get(p.t + 24 * 3600e3);
        if (q && q.windKt! - p.windKt! >= 30 && (!best || q.windKt! - p.windKt! > best.to - best.from))
          best = { name: s.name, season: s.season, sid: s.sid, start: p.time, from: p.windKt!, to: q.windKt!, basin: b };
      }
      if (best) ri.push(best);
    }
    return { perYear: [...perYear.values()].sort((x, y) => x.season - y.season), months, dist, basin, ri: ri.sort((x, y) => y.season - x.season) };
  }, [storms]);

  return (
    <div className="space-y-3">
      <DatasetGate ds={ni}>
        <div className="flex items-end gap-3">
          <Select label="From season" value={from} onChange={setFrom} options={allSeasons.filter((s) => s >= 1950).map((s) => ({ value: String(s), label: String(s) }))} />
          <div className="text-xs text-slate-500">{storms.length} systems of depression intensity or higher (IMD wind ≥ 17 kt) · to {allSeasons[allSeasons.length - 1]}</div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="Cyclone frequency per season">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={a.perYear}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="season" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} /><Legend />
                <Line dataKey="systems" name="Depressions & above" stroke="#38bdf8" dot={false} /><Line dataKey="cs" name="Cyclonic storms (≥34 kt)" stroke="#facc15" dot={false} /><Line dataKey="severe" name="Severe (≥48 kt)" stroke="#ef4444" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Peak-intensity distribution (IMD scale)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={a.dist}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="grade" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} /><Legend />
                <Bar dataKey="AS" name="Arabian Sea" fill="#f97316" /><Bar dataKey="BB" name="Bay of Bengal" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Seasonal distribution (genesis month)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={a.months}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="month" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} /><Legend />
                <Bar dataKey="AS" name="Arabian Sea" stackId="a" fill="#f97316" /><Bar dataKey="BB" name="Bay of Bengal" stackId="a" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Arabian Sea vs Bay of Bengal">
            <div className="grid grid-cols-2 gap-2">
              {(['AS', 'BB'] as const).map((b) => {
                const x = a.basin[b];
                return (
                  <div key={b} className="space-y-2">
                    <div className="text-sm font-semibold">{b === 'AS' ? 'Arabian Sea' : 'Bay of Bengal'}</div>
                    <Stat label="Systems" value={x.n} />
                    <Stat label="Reached CS (≥34 kt)" value={x.n ? `${x.cs} (${((100 * x.cs) / x.n).toFixed(0)}%)` : '—'} />
                    <Stat label="Mean peak wind" value={x.n ? `${(x.wind / x.n).toFixed(1)} kt` : '—'} />
                    <Stat label="Mean lifetime" value={x.n ? `${(x.hours / x.n / 24).toFixed(1)} days` : '—'} />
                  </div>);
              })}
            </div>
          </Card>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <Card title={`Rapid intensification events (≥30 kt in 24 h) — ${a.ri.length}`}>
            <div className="max-h-80 overflow-auto">
              <table className="num w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-1">Storm</th><th>Basin</th><th>Start (UTC)</th><th>Wind change</th></tr></thead>
                <tbody>{a.ri.map((r) => <tr key={r.sid} className="border-t border-slate-800"><td className="py-0.5">{r.name} ({r.season})</td><td>{r.basin}</td><td>{fmtTime(r.start)}</td><td>{r.from} → {r.to} kt (+{r.to - r.from})</td></tr>)}</tbody>
              </table>
            </div>
          </Card>
          <Card title="Historical tracks (selected period, ≥ CS)" right={<ImdLegend />}>
            <TrackMap storms={storms.filter((s) => s.maxWindKt! >= 34)} className="h-80" />
          </Card>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Unavailable tag="auth" title="Rainfall / QPE relationship — not available" reason="Requires an archive of INSAT-3D/3DR QPE products from MOSDAC matched to storm positions. MOSDAC access needs authentication and a backend ingestion service." />
          <Unavailable tag="auth" title="SST relationship — not available" reason="Requires historical INSAT/MOSDAC SST fields matched to storm positions (backend + MOSDAC credentials). Current point SST context is shown on Live Monitoring from an external model source." />
        </div>
      </DatasetGate>
      <DataSources rows={[{ source: 'IBTrACS v04r01 – RSMC New Delhi columns', product: 'ibtracs.NI.list.v04r01.csv', url: ni.officialUrl, retrieved: fmtTime(ni.retrievedAt), coverage: 'North Indian Ocean', status: ni.status === 'ok' ? <Badge tag="official" /> : <Badge tag="unavailable" label={ni.status} /> }]} />
    </div>
  );
}
