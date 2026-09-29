import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchText } from './lib/net';
import { parseIbtracs, type Storm, type ValidationReport } from './lib/ibtracs';
import { IBTRACS_URLS, IBTRACS_ORIGIN_URLS } from './lib/sources';
import { train, type TrainedModel } from './lib/ml';

export interface Dataset {
  status: 'idle' | 'loading' | 'ok' | 'error';
  storms: Storm[];
  report?: ValidationReport;
  retrievedAt?: string;
  lastModified?: string;
  via?: 'network' | 'browser-cache' | 'user-upload';
  requestUrl: string;
  officialUrl: string;
  error?: string;
}

export interface ModelState {
  status: 'idle' | 'training' | 'ok' | 'unavailable';
  model?: TrainedModel;
  reason?: string;
}

interface Ctx {
  ni: Dataset;
  active: Dataset;
  model: ModelState;
  reload: (which: 'NI' | 'ACTIVE') => void;
  uploadNi: (file: File) => void;
}

const DataCtx = createContext<Ctx | null>(null);
export const useData = () => useContext(DataCtx)!;

const empty = (k: 'NI' | 'ACTIVE'): Dataset => ({ status: 'idle', storms: [], requestUrl: IBTRACS_URLS[k], officialUrl: IBTRACS_ORIGIN_URLS[k] });

export function DataProvider({ children }: { children: ReactNode }) {
  const [ni, setNi] = useState<Dataset>(empty('NI'));
  const [active, setActive] = useState<Dataset>(empty('ACTIVE'));
  const [model, setModel] = useState<ModelState>({ status: 'idle' });
  const started = useRef(false);

  const runTraining = useCallback((storms: Storm[], retrievedAt: string) => {
    setModel({ status: 'training' });
    setTimeout(() => {
      try {
        const r = train(storms, retrievedAt);
        setModel('error' in r ? { status: 'unavailable', reason: r.error } : { status: 'ok', model: r });
      } catch (e) {
        setModel({ status: 'unavailable', reason: `Training failed: ${(e as Error).message}` });
      }
    }, 50);
  }, []);

  const load = useCallback(async (which: 'NI' | 'ACTIVE', force = false) => {
    const set = which === 'NI' ? setNi : setActive;
    set((d) => ({ ...d, status: 'loading', error: undefined }));
    try {
      if (force && 'caches' in window) await caches.delete(`ibtracs-${which}`).catch(() => {});
      const r = await fetchText(IBTRACS_URLS[which], {
        source: `IBTrACS ${which}`, timeoutMs: 120000, retries: 2,
        cacheName: `ibtracs-${which}`, maxAgeMs: which === 'NI' ? 24 * 3600e3 : 3 * 3600e3,
      });
      const { storms, report } = parseIbtracs(r.text, 'NI');
      if (report.columnsMissing.length) throw new Error(`Unexpected file format: missing columns ${report.columnsMissing.join(', ')}`);
      set((d) => ({ ...d, status: 'ok', storms, report, retrievedAt: r.retrievedAt, lastModified: r.lastModified, via: r.fromCache ? 'browser-cache' : 'network' }));
      if (which === 'NI') runTraining(storms, r.retrievedAt);
    } catch (e) {
      set((d) => ({ ...d, status: 'error', storms: [], error: (e as Error).message }));
      if (which === 'NI') setModel({ status: 'unavailable', reason: 'Model unavailable: official training data (IBTrACS NI / RSMC New Delhi) could not be retrieved.' });
    }
  }, [runTraining]);

  const uploadNi = useCallback((file: File) => {
    setNi((d) => ({ ...d, status: 'loading', error: undefined }));
    file.text().then((text) => {
      const { storms, report } = parseIbtracs(text, 'NI');
      if (report.columnsMissing.length || !storms.length) {
        setNi((d) => ({ ...d, status: 'error', storms: [], error: `File is not an IBTrACS v04 CSV (missing: ${report.columnsMissing.join(', ') || 'North Indian records'})` }));
        return;
      }
      const at = new Date().toISOString();
      setNi((d) => ({ ...d, status: 'ok', storms, report, retrievedAt: at, lastModified: new Date(file.lastModified).toUTCString(), via: 'user-upload', requestUrl: `local file: ${file.name}` }));
      runTraining(storms, at);
    });
  }, [runTraining]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load('NI');
    load('ACTIVE');
  }, [load]);

  return <DataCtx.Provider value={{ ni, active, model, reload: (w) => load(w, true), uploadNi }}>{children}</DataCtx.Provider>;
}
