import type { ReactNode } from 'react';

export const fmtTime = (iso?: string) => (iso ? iso.replace('T', ' ').slice(0, 16) + ' UTC' : '—');
export const fmtNum = (v: number | null | undefined, d = 1, unit = '') => (v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(d)}${unit}`);
export const fmtLat = (v: number) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'N' : 'S'}`;
export const fmtLon = (v: number) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'E' : 'W'}`;

export function Card({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-slate-800 bg-slate-900/70 ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export type Tag = 'official' | 'ml' | 'unavailable' | 'external' | 'auth';
const TAGS: Record<Tag, [string, string]> = {
  official: ['Official observation', 'bg-emerald-900/60 text-emerald-300 border-emerald-700'],
  ml: ['AI/ML prediction', 'bg-violet-900/60 text-violet-300 border-violet-700'],
  unavailable: ['Unavailable', 'bg-slate-800 text-slate-400 border-slate-600'],
  external: ['External source', 'bg-sky-900/60 text-sky-300 border-sky-700'],
  auth: ['Authentication required', 'bg-amber-900/60 text-amber-300 border-amber-700'],
};
export function Badge({ tag, label }: { tag: Tag; label?: string }) {
  const [l, c] = TAGS[tag];
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${c}`}>{label ?? l}</span>;
}

export function Unavailable({ title = 'Official data unavailable', reason, tag = 'unavailable' }: { title?: string; reason: ReactNode; tag?: Tag }) {
  return (
    <div className="rounded border border-dashed border-slate-700 bg-slate-950/60 p-3 text-sm">
      <div className="mb-1 flex items-center gap-2"><Badge tag={tag} /><span className="font-medium text-slate-200">{title}</span></div>
      <div className="text-slate-400">{reason}</div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="num text-lg font-semibold text-slate-100">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export interface SourceRow { source: string; product: string; url?: string; observation?: string; retrieved?: string; coverage?: string; status: ReactNode }
export function DataSources({ rows }: { rows: SourceRow[] }) {
  return (
    <Card title="Data sources">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr><th className="py-1 pr-3">Source</th><th className="pr-3">Dataset / product</th><th className="pr-3">Observation</th><th className="pr-3">Retrieved</th><th className="pr-3">Coverage</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-800 align-top">
                <td className="py-1 pr-3 text-slate-200">{r.source}</td>
                <td className="pr-3">{r.url ? <a className="text-sky-400 hover:underline" href={r.url} target="_blank" rel="noreferrer">{r.product}</a> : r.product}</td>
                <td className="num pr-3">{r.observation ?? '—'}</td>
                <td className="num pr-3">{r.retrieved ?? '—'}</td>
                <td className="pr-3">{r.coverage ?? '—'}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Select<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; disabled?: boolean }[]; label?: string }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-slate-500">
      {label}
      <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm normal-case tracking-normal text-slate-200" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
    </label>
  );
}
