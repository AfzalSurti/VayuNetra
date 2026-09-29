import { fetchJson } from './net';

export interface PointEnv {
  sstC: number | null;
  wind10mKt: number | null;
  pmslHpa: number | null;
  validTime: string | null;
  retrievedAt: string;
  errors: string[];
}

interface OmCurrent { current?: Record<string, number | string>; current_units?: Record<string, string> }

/** Model-based environmental context at a point (external source, NOT an official observation). */
export async function pointEnvironment(lat: number, lon: number): Promise<PointEnv> {
  const errors: string[] = [];
  const la = lat.toFixed(2), lo = lon.toFixed(2);
  const [m, f] = await Promise.allSettled([
    fetchJson<OmCurrent>(`https://marine-api.open-meteo.com/v1/marine?latitude=${la}&longitude=${lo}&current=sea_surface_temperature&timezone=GMT`, { source: 'Open-Meteo Marine', timeoutMs: 15000 }),
    fetchJson<OmCurrent>(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=wind_speed_10m,pressure_msl&wind_speed_unit=kn&timezone=GMT`, { source: 'Open-Meteo Forecast', timeoutMs: 15000 }),
  ]);
  const val = (r: typeof m, k: string) => {
    if (r.status !== 'fulfilled') return null;
    const v = r.value.data.current?.[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  if (m.status === 'rejected') errors.push(`Marine API: ${(m.reason as Error).message}`);
  if (f.status === 'rejected') errors.push(`Forecast API: ${(f.reason as Error).message}`);
  const t = f.status === 'fulfilled' ? f.value.data.current?.time : m.status === 'fulfilled' ? m.value.data.current?.time : null;
  return {
    sstC: val(m, 'sea_surface_temperature'), wind10mKt: val(f, 'wind_speed_10m'), pmslHpa: val(f, 'pressure_msl'),
    validTime: typeof t === 'string' ? `${t}Z` : null, retrievedAt: new Date().toISOString(), errors,
  };
}
