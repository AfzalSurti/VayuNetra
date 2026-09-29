import { useData, type Dataset } from '../store';
import { Badge, Card, fmtTime } from '../components/ui';
import { SOURCES } from '../lib/sources';

function Validation({ title, ds }: { title: string; ds: Dataset }) {
  const r = ds.report;
  return (
    <Card title={title}>
      <div className="space-y-1 text-xs text-slate-300">
        <div>Status: {ds.status}{ds.error && <span className="text-red-300"> — {ds.error}</span>}</div>
        <div>Official file: <a className="text-sky-400 underline" href={ds.officialUrl} target="_blank" rel="noreferrer">{ds.officialUrl}</a></div>
        <div>Requested via: <span className="font-mono">{ds.requestUrl}</span> ({ds.via ?? '—'})</div>
        <div>Retrieved: {fmtTime(ds.retrievedAt)} · Server Last-Modified: {ds.lastModified || '—'}</div>
        {r && (
          <>
            <div>Rows read {r.rowsRead} · accepted {r.rowsAccepted} · with IMD (RSMC New Delhi) position {r.withImdPosition} · duplicates dropped {r.duplicates}</div>
            <div>Rejected: {Object.entries(r.rejected).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'none'}</div>
            <div>Storms: {ds.storms.length}</div>
          </>
        )}
      </div>
    </Card>
  );
}

export default function DataSourcesPage() {
  const { ni, active } = useData();
  return (
    <div className="space-y-3">
      <Card title="Source registry">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-1 pr-2">Source</th><th className="pr-2">Organization</th><th className="pr-2">Products</th><th className="pr-2">Class</th><th className="pr-2">Access in this build</th><th>Notes</th></tr></thead>
            <tbody>{SOURCES.map((s) => (
              <tr key={s.id} className="border-t border-slate-800 align-top">
                <td className="py-1 pr-2"><a className="text-sky-400 underline" href={s.homepage} target="_blank" rel="noreferrer">{s.name}</a></td>
                <td className="pr-2">{s.organization}</td><td className="pr-2">{s.products}</td>
                <td className="pr-2">{s.official === 'indian-official' ? 'Indian Govt. official' : s.official === 'international-official' ? 'International official archive' : 'External'}</td>
                <td className="pr-2">{s.access === 'connected' ? <Badge tag="official" label="Connected" /> : s.access === 'auth-required' ? <Badge tag="auth" /> : s.access === 'external' ? <Badge tag="external" /> : <Badge tag="unavailable" label="Backend required" />}</td>
                <td className="text-slate-400">{s.note}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <Validation title="Ingestion & validation — IBTrACS NI" ds={ni} />
        <Validation title="Ingestion & validation — IBTrACS ACTIVE" ds={active} />
      </div>
      <Card title="Validation rules applied">
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-300">
          <li>Header must contain SID, SEASON, BASIN, NAME, ISO_TIME, LAT, LON; units row skipped.</li>
          <li>Basin = NI only; spur (non-main) tracks excluded.</li>
          <li>Timestamps must parse as UTC and not lie in the future.</li>
          <li>Coordinates must be present and within valid ranges; RSMC New Delhi position preferred, IBTrACS combined position used only when IMD position is absent (flagged per fix).</li>
          <li>Duplicate (storm, time) observations dropped.</li>
          <li>Wind 0–250 kt and pressure 850–1050 hPa, otherwise set to missing (never imputed).</li>
          <li>Every fix keeps its source column; every page shows source, retrieval time and status.</li>
        </ul>
      </Card>
    </div>
  );
}
