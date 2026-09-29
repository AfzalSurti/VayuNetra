// IBTrACS CSV ingestion → validation → normalisation.
// Uses the RSMC New Delhi (IMD) columns when present.

export interface TrackPoint {
  time: string; // ISO UTC
  t: number; // epoch ms
  lat: number;
  lon: number;
  windKt: number | null;
  presHpa: number | null;
  grade: string | null; // NEWDELHI_GRADE as reported
  subbasin: string;
  nature: string;
  /** IBTrACS LANDFALL == 0: land reached within the next 6 h (or over land). */
  landWithin6h: boolean | null;
  distToLandKm: number | null;
  posSource: 'NEWDELHI' | 'IBTRACS';
}

export interface Storm {
  sid: string;
  name: string;
  season: number;
  subbasin: string; // AS / BB / MM
  points: TrackPoint[]; // sorted by time
  maxWindKt: number | null;
  minPresHpa: number | null;
  start: string;
  end: string;
}

export interface ValidationReport {
  rowsRead: number;
  rowsAccepted: number;
  rejected: Record<string, number>;
  duplicates: number;
  withImdPosition: number;
  columnsMissing: string[];
}

const REQUIRED = ['SID', 'SEASON', 'BASIN', 'NAME', 'ISO_TIME', 'LAT', 'LON'];

function splitCsvLine(line: string): string[] {
  if (!line.includes('"')) return line.split(',');
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

const num = (s: string | undefined) => {
  if (s == null) return null;
  const v = s.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function parseIbtracs(csv: string, basinFilter = 'NI'): { storms: Storm[]; report: ValidationReport } {
  const lines = csv.split(/\r?\n/);
  const header = splitCsvLine(lines[0] ?? '').map((h) => h.trim());
  const idx = (k: string) => header.indexOf(k);
  const missing = REQUIRED.filter((k) => idx(k) < 0);
  const report: ValidationReport = { rowsRead: 0, rowsAccepted: 0, rejected: {}, duplicates: 0, withImdPosition: 0, columnsMissing: missing };
  if (missing.length) return { storms: [], report };
  const rej = (why: string) => (report.rejected[why] = (report.rejected[why] ?? 0) + 1);

  const I = {
    sid: idx('SID'), season: idx('SEASON'), basin: idx('BASIN'), sub: idx('SUBBASIN'), name: idx('NAME'),
    time: idx('ISO_TIME'), nature: idx('NATURE'), lat: idx('LAT'), lon: idx('LON'), trackType: idx('TRACK_TYPE'),
    landfall: idx('LANDFALL'), dist2land: idx('DIST2LAND'),
    ndLat: idx('NEWDELHI_LAT'), ndLon: idx('NEWDELHI_LON'), ndGrade: idx('NEWDELHI_GRADE'),
    ndWind: idx('NEWDELHI_WIND'), ndPres: idx('NEWDELHI_PRES'),
  };

  const byStorm = new Map<string, Storm>();
  const seen = new Set<string>();
  // Line 1 of IBTrACS CSV is the units row → start at 2
  for (let li = 2; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    report.rowsRead++;
    const f = splitCsvLine(line);
    const g = (i: number) => (i >= 0 ? (f[i] ?? '').trim() : '');
    if (basinFilter && g(I.basin) !== basinFilter) { rej('outside basin'); continue; }
    if (I.trackType >= 0 && g(I.trackType) && !g(I.trackType).startsWith('main')) { rej('non-main track (spur)'); continue; }
    const t = Date.parse(g(I.time).replace(' ', 'T') + 'Z');
    if (!Number.isFinite(t)) { rej('invalid timestamp'); continue; }
    if (t > Date.now() + 3600e3) { rej('timestamp in future'); continue; }

    const ndLat = num(g(I.ndLat));
    const ndLon = num(g(I.ndLon));
    const hasNd = ndLat != null && ndLon != null;
    const lat = hasNd ? ndLat! : num(g(I.lat));
    const lon = hasNd ? ndLon! : num(g(I.lon));
    if (lat == null || lon == null) { rej('missing coordinates'); continue; }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 360) { rej('invalid coordinates'); continue; }

    const sid = g(I.sid);
    const key = `${sid}|${t}`;
    if (seen.has(key)) { report.duplicates++; continue; }
    seen.add(key);

    let wind = num(g(I.ndWind));
    if (wind != null && (wind < 0 || wind > 250)) { rej('wind out of physical range'); wind = null; }
    let pres = num(g(I.ndPres));
    if (pres != null && (pres < 850 || pres > 1050)) { rej('pressure out of physical range'); pres = null; }
    const lf = num(g(I.landfall));

    const p: TrackPoint = {
      time: new Date(t).toISOString(), t, lat, lon: lon > 180 ? lon - 360 : lon,
      windKt: wind, presHpa: pres, grade: g(I.ndGrade) || null,
      subbasin: g(I.sub), nature: g(I.nature), landWithin6h: lf == null ? null : lf === 0,
      distToLandKm: num(g(I.dist2land)),
      posSource: hasNd ? 'NEWDELHI' : 'IBTRACS',
    };
    if (hasNd) report.withImdPosition++;
    report.rowsAccepted++;

    let s = byStorm.get(sid);
    if (!s) {
      const name = g(I.name);
      s = { sid, name: name && name !== 'NOT_NAMED' ? name : 'UNNAMED', season: Number(g(I.season)), subbasin: '', points: [], maxWindKt: null, minPresHpa: null, start: '', end: '' };
      byStorm.set(sid, s);
    }
    s.points.push(p);
  }

  const storms = [...byStorm.values()].map((s) => {
    s.points.sort((a, b) => a.t - b.t);
    const winds = s.points.map((p) => p.windKt).filter((v): v is number => v != null);
    const pres = s.points.map((p) => p.presHpa).filter((v): v is number => v != null);
    s.maxWindKt = winds.length ? Math.max(...winds) : null;
    s.minPresHpa = pres.length ? Math.min(...pres) : null;
    s.start = s.points[0].time;
    s.end = s.points[s.points.length - 1].time;
    // Genesis sub-basin (IBTrACS: AS = Arabian Sea, BB = Bay of Bengal)
    s.subbasin = s.points.find((p) => p.subbasin === 'AS' || p.subbasin === 'BB')?.subbasin ?? s.points[0].subbasin;
    return s;
  });
  storms.sort((a, b) => b.start.localeCompare(a.start));
  return { storms, report };
}

/** Only points that carry an IMD (RSMC New Delhi) position. */
export const imdPoints = (s: Storm) => s.points.filter((p) => p.posSource === 'NEWDELHI');
