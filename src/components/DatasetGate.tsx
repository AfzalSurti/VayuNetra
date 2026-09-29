import type { ReactNode } from 'react';
import { useData, type Dataset } from '../store';
import { Unavailable } from './ui';

/** Renders children only when the dataset is loaded; otherwise shows the honest status. */
export function DatasetGate({ ds, children, label = 'IMD / RSMC New Delhi best track (IBTrACS NI)' }: { ds: Dataset; children: ReactNode; label?: string }) {
  const { uploadNi, reload } = useData();
  if (ds.status === 'ok') return <>{children}</>;
  if (ds.status === 'loading' || ds.status === 'idle')
    return <div className="rounded border border-slate-800 p-4 text-sm text-slate-400">Retrieving {label} from {ds.requestUrl} …</div>;
  return (
    <Unavailable
      reason={
        <div className="space-y-2">
          <div>{label} could not be retrieved: <span className="text-red-300">{ds.error}</span></div>
          <div>Official file: <a className="text-sky-400 underline" href={ds.officialUrl} target="_blank" rel="noreferrer">{ds.officialUrl}</a></div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded border border-slate-600 px-2 py-1 text-slate-200 hover:bg-slate-800" onClick={() => reload(ds.officialUrl.includes('ACTIVE') ? 'ACTIVE' : 'NI')}>Retry</button>
            {!ds.officialUrl.includes('ACTIVE') && (
              <label className="cursor-pointer rounded border border-slate-600 px-2 py-1 text-slate-200 hover:bg-slate-800">
                Load the unmodified official CSV from disk
                <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && uploadNi(e.target.files[0])} />
              </label>
            )}
          </div>
        </div>
      }
    />
  );
}
