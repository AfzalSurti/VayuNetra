import { useEffect, useState } from 'react';
import { useData } from './store';
import { fmtTime } from './components/ui';
import Overview from './pages/Overview';
import LiveMonitoring from './pages/LiveMonitoring';
import Explorer from './pages/Explorer';
import SatelliteViewer from './pages/SatelliteViewer';
import Prediction from './pages/Prediction';
import Historical from './pages/Historical';
import ModelPerformance from './pages/ModelPerformance';
import DataSourcesPage from './pages/DataSourcesPage';
import SystemStatus from './pages/SystemStatus';

const PAGES = [
  ['overview', 'Overview', Overview],
  ['live', 'Live Monitoring', LiveMonitoring],
  ['explorer', 'Cyclone Explorer', Explorer],
  ['satellite', 'Satellite Viewer', SatelliteViewer],
  ['prediction', 'AI Prediction', Prediction],
  ['historical', 'Historical Analysis', Historical],
  ['models', 'Model Performance', ModelPerformance],
  ['sources', 'Data Sources', DataSourcesPage],
  ['status', 'System Status', SystemStatus],
] as const;

function useHash() {
  const [h, setH] = useState(() => location.hash.slice(2) || 'overview');
  useEffect(() => {
    const f = () => setH(location.hash.slice(2) || 'overview');
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h;
}

function Dot({ s }: { s: 'ok' | 'warn' | 'err' | 'idle' }) {
  const c = { ok: 'bg-emerald-400', warn: 'bg-amber-400', err: 'bg-red-500', idle: 'bg-slate-500' }[s];
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} />;
}

export default function App() {
  const route = useHash();
  const { ni, active, model } = useData();
  const Page = (PAGES.find((p) => p[0] === route) ?? PAGES[0])[2];
  const st = (d: typeof ni) => (d.status === 'ok' ? 'ok' : d.status === 'error' ? 'err' : d.status === 'loading' ? 'warn' : 'idle');

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-950 px-4 py-2">
        <div>
          <div className="text-base font-bold tracking-wide text-slate-100">VAYUNETRA <span className="font-normal text-slate-400">· North Indian Ocean Cyclone Monitoring</span></div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">SIH26070 prototype · frontend-only build</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4 text-xs text-slate-300">
          <span className="flex items-center gap-1.5"><Dot s={st(ni)} />IMD best track (IBTrACS NI): {ni.status}</span>
          <span className="flex items-center gap-1.5"><Dot s={st(active)} />Active storms feed: {active.status}</span>
          <span className="flex items-center gap-1.5"><Dot s="err" />MOSDAC: auth required</span>
          <span className="flex items-center gap-1.5"><Dot s={model.status === 'ok' ? 'ok' : model.status === 'training' ? 'warn' : 'err'} />ML model: {model.status}</span>
          <span className="text-slate-500">Last update: {fmtTime([ni.retrievedAt, active.retrievedAt].filter(Boolean).sort().pop())}</span>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950 p-2 md:w-48 md:flex-col md:border-b-0 md:border-r">
          {PAGES.map(([id, label]) => (
            <a key={id} href={`#/${id}`} className={`whitespace-nowrap rounded px-3 py-1.5 text-sm ${route === id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>{label}</a>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-3 md:p-4"><Page /></main>
      </div>
    </div>
  );
}
