// Network layer: timeouts, retry with exponential backoff, per-host rate limiting,
// Cache Storage for official files, and a request log shown on the System Status page.

export interface RequestLogEntry {
  id: number;
  source: string;
  url: string;
  startedAt: string;
  durationMs: number;
  status: 'ok' | 'error';
  httpStatus?: number;
  bytes?: number;
  attempts: number;
  fromCache: boolean;
  error?: string;
}

type Listener = (log: RequestLogEntry[]) => void;
let log: RequestLogEntry[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

export function subscribeLog(fn: Listener) {
  listeners.add(fn);
  fn(log);
  return () => listeners.delete(fn);
}
function pushLog(e: Omit<RequestLogEntry, 'id'>) {
  log = [{ ...e, id: nextId++ }, ...log].slice(0, 200);
  listeners.forEach((l) => l(log));
}

const lastHit = new Map<string, number>();
const MIN_INTERVAL_MS = 1000; // at most ~1 request/second per host

async function rateLimit(url: string) {
  const host = new URL(url, location.href).host;
  const now = Date.now();
  const wait = Math.max(0, (lastHit.get(host) ?? 0) + MIN_INTERVAL_MS - now);
  lastHit.set(host, now + wait);
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

export class FetchError extends Error {
  constructor(message: string, public httpStatus?: number) {
    super(message);
  }
}

export interface FetchOpts {
  source: string;
  timeoutMs?: number;
  retries?: number;
  cacheName?: string; // use Cache Storage
  maxAgeMs?: number;
}

export interface FetchTextResult {
  text: string;
  retrievedAt: string; // when fetched from origin
  fromCache: boolean;
  lastModified?: string;
}

export async function fetchText(url: string, o: FetchOpts): Promise<FetchTextResult> {
  const started = Date.now();
  const cacheKey = new URL(url, location.href).toString();

  if (o.cacheName && 'caches' in window) {
    try {
      const cache = await caches.open(o.cacheName);
      const hit = await cache.match(cacheKey);
      const at = hit?.headers.get('x-retrieved-at');
      if (hit && at && Date.now() - Date.parse(at) < (o.maxAgeMs ?? 6 * 3600e3)) {
        const text = await hit.text();
        pushLog({ source: o.source, url, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, status: 'ok', httpStatus: 200, bytes: text.length, attempts: 0, fromCache: true });
        return { text, retrievedAt: at, fromCache: true, lastModified: hit.headers.get('x-last-modified') ?? undefined };
      }
    } catch { /* cache unavailable — fall through to network */ }
  }

  const retries = o.retries ?? 3;
  let lastErr: FetchError = new FetchError('unknown error');
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 30000);
    try {
      await rateLimit(url);
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new FetchError(`HTTP ${res.status} ${res.statusText}`, res.status);
      const text = await res.text();
      const retrievedAt = new Date().toISOString();
      const lastModified = res.headers.get('last-modified') ?? undefined;
      pushLog({ source: o.source, url, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, status: 'ok', httpStatus: res.status, bytes: text.length, attempts: attempt, fromCache: false });
      if (o.cacheName && 'caches' in window) {
        try {
          const cache = await caches.open(o.cacheName);
          await cache.put(cacheKey, new Response(text, { headers: { 'x-retrieved-at': retrievedAt, 'x-last-modified': lastModified ?? '' } }));
        } catch { /* ignore quota errors */ }
      }
      return { text, retrievedAt, fromCache: false, lastModified };
    } catch (e) {
      const err = e as Error;
      lastErr = err instanceof FetchError ? err
        : new FetchError(err.name === 'AbortError' ? `Timed out after ${(o.timeoutMs ?? 30000) / 1000}s`
          : `${err.message} (network error or the server does not permit cross-origin browser access / CORS)`);
      // 4xx other than 429 will not improve on retry
      if (lastErr.httpStatus && lastErr.httpStatus < 500 && lastErr.httpStatus !== 429) break;
      if (attempt <= retries) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(t);
    }
  }
  pushLog({ source: o.source, url, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started, status: 'error', httpStatus: lastErr.httpStatus, attempts: retries + 1, fromCache: false, error: lastErr.message });
  throw lastErr;
}

export async function fetchJson<T>(url: string, o: FetchOpts): Promise<{ data: T; retrievedAt: string }> {
  const r = await fetchText(url, o);
  try {
    return { data: JSON.parse(r.text) as T, retrievedAt: r.retrievedAt };
  } catch {
    throw new FetchError('Response was not valid JSON');
  }
}
