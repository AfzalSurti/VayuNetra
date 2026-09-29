import { useEffect, useState } from 'react';
import { subscribeLog, type RequestLogEntry } from '../lib/net';
import { useData } from '../store';
import { Badge, Card, fmtTime } from '../components/ui';

export default function SystemStatus() {
  const { ni, active, model, reload } = useData();
  const [log, setLog] = useState<RequestLogEntry[]>([]);
  useEffect(() => { const u = subscribeLog(setLog); return () => { u(); }; }, []);
  const comp = (name: string, ok: boolean, detail: string, tag?: 'auth') => (
    <tr className="border-t border-slate-800"><td className="py-1">{name}</td><td>{tag ? <Badge tag="auth" /> : ok ? <Badge tag="official" label="OK" /> : <Badge tag="unavailable" label="Down / unavailable" />}</td><td className="text-slate-400">{detail}</td></tr>
  );
  return (
    <div className="space-y-3">
      <Card title="Components" right={<div className="flex gap-2"><button className="rounded border border-slate-600 px-2 py-0.5 text-xs hover:bg-slate-800" onClick={() => reload('NI')}>Refresh NI</button><button className="rounded border border-slate-600 px-2 py-0.5 text-xs hover:bg-slate-800" onClick={() => reload('ACTIVE')}>Refresh ACTIVE</button></div>}>
        <table className="w-full text-left text-xs"><tbody>
          {comp('Ingestion: IBTrACS NI (RSMC New Delhi best track)', ni.status === 'ok', ni.error ?? `${ni.status} · retrieved ${fmtTime(ni.retrievedAt)} (${ni.via ?? '—'})`)}
          {comp('Ingestion: IBTrACS ACTIVE', active.status === 'ok', active.error ?? `${active.status} · retrieved ${fmtTime(active.retrievedAt)}`)}
          {comp('Ingestion: MOSDAC INSAT-3D/3DR/3DS', false, 'Not connected — requires authenticated backend service', 'auth')}
          {comp('Ingestion: IMD RSMC bulletins', false, 'Not connected — no verified public machine-readable API; requires backend')}
          {comp('ML: ridge track/intensity model', model.status === 'ok', model.model ? `${model.model.version} trained ${fmtTime(model.model.trainedAt)}` : model.reason ?? model.status)}
          {comp('Database (PostgreSQL/PostGIS)', false, 'Not part of the frontend-only prototype; browser Cache Storage used for official files')}
        </tbody></table>
      </Card>
      <Card title={`API request log (${log.length})`}>
        <div className="max-h-[480px] overflow-auto">
          <table className="num w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900 text-slate-500"><tr><th className="py-1">Time</th><th>Source</th><th>Status</th><th>HTTP</th><th>Attempts</th><th>Cache</th><th>Bytes</th><th>ms</th><th>URL / error</th></tr></thead>
            <tbody>{log.map((e) => (
              <tr key={e.id} className="border-t border-slate-800 align-top">
                <td className="py-0.5">{fmtTime(e.startedAt)}</td><td>{e.source}</td><td className={e.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{e.status}</td><td>{e.httpStatus ?? '—'}</td><td>{e.attempts}</td><td>{e.fromCache ? 'hit' : '—'}</td><td>{e.bytes ?? '—'}</td><td>{e.durationMs}</td>
                <td className="break-all font-mono text-[10px] text-slate-400">{e.url}{e.error && <div className="text-red-300">{e.error}</div>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
