const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle (haversine) distance in km. */
export function gcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing in degrees (0 = N, clockwise). */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function compass(b: number) {
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return pts[Math.round(b / 22.5) % 16];
}

/**
 * IMD classification of cyclonic disturbances in the North Indian Ocean by
 * maximum sustained surface wind (knots), as published by IMD / RSMC New Delhi.
 */
export const IMD_SCALE = [
  { code: 'LOW', name: 'Low pressure area', min: 0, color: '#64748b' },
  { code: 'D', name: 'Depression', min: 17, color: '#38bdf8' },
  { code: 'DD', name: 'Deep Depression', min: 28, color: '#22d3ee' },
  { code: 'CS', name: 'Cyclonic Storm', min: 34, color: '#facc15' },
  { code: 'SCS', name: 'Severe Cyclonic Storm', min: 48, color: '#fb923c' },
  { code: 'VSCS', name: 'Very Severe Cyclonic Storm', min: 64, color: '#f97316' },
  { code: 'ESCS', name: 'Extremely Severe Cyclonic Storm', min: 90, color: '#ef4444' },
  { code: 'SuCS', name: 'Super Cyclonic Storm', min: 120, color: '#c026d3' },
] as const;

export type ImdCode = (typeof IMD_SCALE)[number]['code'];

export function imdClass(windKt: number | null | undefined) {
  if (windKt == null || !Number.isFinite(windKt)) return null;
  let c: (typeof IMD_SCALE)[number] = IMD_SCALE[0];
  for (const s of IMD_SCALE) if (windKt >= s.min) c = s;
  return c;
}

export const REGIONS = {
  NIO: { name: 'North Indian Ocean', bounds: [[-5, 40], [32, 100]] as [[number, number], [number, number]] },
  AS: { name: 'Arabian Sea', bounds: [[5, 50], [27, 78]] as [[number, number], [number, number]] },
  BB: { name: 'Bay of Bengal', bounds: [[5, 78], [24, 100]] as [[number, number], [number, number]] },
};
