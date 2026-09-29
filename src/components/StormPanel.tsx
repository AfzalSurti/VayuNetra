import type { Storm, TrackPoint } from '../lib/ibtracs';
import { bearingDeg, compass, gcDistanceKm, imdClass } from '../lib/geo';
import { Badge, fmtLat, fmtLon, fmtTime } from './ui';

export function motion(pts: TrackPoint[]) {
  if (pts.length < 2) return null;
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  const hrs = (b.t - a.t) / 3600e3;
  if (hrs <= 0) return null;
  const dir = bearingDeg(a.lat, a.lon, b.lat, b.lon);
  return { dir, speedKmh: gcDistanceKm(a.lat, a.lon, b.lat, b.lon) / hrs, hrs };
}

export function StormPanel({ storm, at, sourceLabel }: { storm: Storm; at?: TrackPoint; sourceLabel: string }) {
  const p = at ?? storm.points[storm.points.length - 1];
  const upto = storm.points.filter((q) => q.t <= p.t);
  const m = motion(upto);
  const cls = imdClass(p.windKt);
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-3 border-b border-slate-800/70 py-1 text-sm"><span className="text-slate-500">{k}</span><span className="num text-right text-slate-100">{v}</span></div>
  );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{storm.name}</div>
          <div className="text-xs text-slate-500">{storm.sid} · season {storm.season} · {storm.subbasin === 'AS' ? 'Arabian Sea' : storm.subbasin === 'BB' ? 'Bay of Bengal' : storm.subbasin || '—'}</div>
        </div>
        <Badge tag="official" />
      </div>
      {row('Classification (IMD grade reported)', p.grade ?? '—')}
      {row('Classification (IMD scale from wind)', cls ? `${cls.code} – ${cls.name}` : 'wind not reported')}
      {row('Position', `${fmtLat(p.lat)}, ${fmtLon(p.lon)}`)}
      {row('Max sustained wind', p.windKt != null ? `${p.windKt} kt (${Math.round(p.windKt * 1.852)} km/h)` : '—')}
      {row('Central pressure', p.presHpa != null ? `${p.presHpa} hPa` : '—')}
      {row('Movement direction', m ? `${compass(m.dir)} (${m.dir.toFixed(0)}°)` : '—')}
      {row('Movement speed', m ? `${m.speedKmh.toFixed(1)} km/h (over last ${m.hrs} h)` : '—')}
      {row('Observation time', fmtTime(p.time))}
      {row('Peak intensity (track)', storm.maxWindKt != null ? `${storm.maxWindKt} kt · ${storm.minPresHpa ?? '—'} hPa` : '—')}
      {row('Position source', p.posSource === 'NEWDELHI' ? 'RSMC New Delhi (IMD)' : 'IBTrACS combined (no IMD fix)')}
      <div className="mt-2 text-[11px] text-slate-500">Source: {sourceLabel}. Movement is derived from the last two fixes.</div>
    </div>
  );
}
