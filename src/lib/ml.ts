// In-browser ML pipeline trained on real IMD (RSMC New Delhi) best-track data from IBTrACS.
//  - Track model: ridge regression predicting 6/12/24/48 h displacement (direct multi-horizon)
//  - Intensity model: ridge regression predicting max sustained wind at each horizon
//  - Classification: IMD grade of predicted intensity vs. observed grade
// Split is chronological by season (train → validation → test); no random split.

import type { Storm, TrackPoint } from './ibtracs';
import { gcDistanceKm, IMD_SCALE, imdClass } from './geo';

export const HORIZONS_H = [6, 12, 24, 48] as const;
const H6 = 6 * 3600e3;
export const MIN_SEASON = 1990;

export const FEATURE_NAMES = ['dlat(t-6→t)', 'dlon(t-6→t)', 'dlat(t-12→t-6)', 'dlon(t-12→t-6)', 'lat', 'lon', 'wind', 'dwind(6h)', 'dwind(12h)', 'sin(month)', 'cos(month)', 'arabian_sea'];

interface Sample {
  season: number;
  sid: string;
  x: number[];
  lat: number;
  lon: number;
  wind: number;
  targets: Record<number, { dlat: number; dlon: number; wind: number } | undefined>;
  persist: { dlat: number; dlon: number }; // 6 h motion vector for extrapolation baseline
}

/** Synoptic (00/06/12/18 UTC) IMD fixes with wind. */
function synoptic(s: Storm): TrackPoint[] {
  return s.points.filter((p) => p.posSource === 'NEWDELHI' && p.windKt != null && new Date(p.t).getUTCHours() % 6 === 0 && new Date(p.t).getUTCMinutes() === 0);
}

export function featuresAt(pts: TrackPoint[], i: number, subbasin: string): number[] | null {
  const p0 = pts[i], p1 = pts[i - 1], p2 = pts[i - 2];
  if (!p0 || !p1 || !p2) return null;
  if (p0.t - p1.t !== H6 || p1.t - p2.t !== H6) return null;
  const m = new Date(p0.t).getUTCMonth();
  return [
    p0.lat - p1.lat, p0.lon - p1.lon, p1.lat - p2.lat, p1.lon - p2.lon,
    p0.lat, p0.lon, p0.windKt!, p0.windKt! - p1.windKt!, p1.windKt! - p2.windKt!,
    Math.sin((2 * Math.PI * m) / 12), Math.cos((2 * Math.PI * m) / 12), subbasin === 'AS' ? 1 : 0,
  ];
}

function buildSamples(storms: Storm[]): Sample[] {
  const out: Sample[] = [];
  for (const s of storms) {
    if (s.season < MIN_SEASON) continue;
    const pts = synoptic(s);
    const byT = new Map(pts.map((p) => [p.t, p]));
    for (let i = 2; i < pts.length; i++) {
      const x = featuresAt(pts, i, s.subbasin);
      if (!x) continue;
      const p0 = pts[i];
      const targets: Sample['targets'] = {};
      for (const h of HORIZONS_H) {
        const f = byT.get(p0.t + h * 3600e3);
        if (f) targets[h] = { dlat: f.lat - p0.lat, dlon: f.lon - p0.lon, wind: f.windKt! };
      }
      out.push({ season: s.season, sid: s.sid, x, lat: p0.lat, lon: p0.lon, wind: p0.windKt!, targets, persist: { dlat: x[0], dlon: x[1] } });
    }
  }
  return out;
}

// ---------- ridge regression ----------
interface Ridge { mean: number[]; std: number[]; w: number[]; b: number; lambda: number }

function solve(A: number[][], y: number[]): number[] {
  const n = y.length;
  const M = A.map((r, i) => [...r, y[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}

function fitRidge(X: number[][], y: number[], lambda: number): Ridge {
  const d = X[0].length, n = X.length;
  const mean = Array(d).fill(0), std = Array(d).fill(0);
  X.forEach((r) => r.forEach((v, j) => (mean[j] += v / n)));
  X.forEach((r) => r.forEach((v, j) => (std[j] += (v - mean[j]) ** 2 / n)));
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j]) || 1;
  const b = y.reduce((a, v) => a + v, 0) / n;
  const A = Array.from({ length: d }, () => Array(d).fill(0));
  const r = Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    const z = X[i].map((v, j) => (v - mean[j]) / std[j]);
    const yi = y[i] - b;
    for (let j = 0; j < d; j++) {
      r[j] += z[j] * yi;
      for (let k = j; k < d; k++) A[j][k] += z[j] * z[k];
    }
  }
  for (let j = 0; j < d; j++) { for (let k = 0; k < j; k++) A[j][k] = A[k][j]; A[j][j] += lambda; }
  return { mean, std, w: solve(A, r), b, lambda };
}
const predictRidge = (m: Ridge, x: number[]) => m.b + x.reduce((a, v, j) => a + ((v - m.mean[j]) / m.std[j]) * m.w[j], 0);

// ---------- metrics ----------
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const rmse = (a: number[]) => Math.sqrt(mean(a.map((v) => v * v)));
const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export interface HorizonMetrics {
  horizon: number;
  nTrain: number; nTest: number;
  trackMeanKm: number; trackRmseKm: number; trackP90Km: number; latMaeDeg: number; lonMaeDeg: number;
  baselineTrackMeanKm: number;
  windMaeKt: number; windRmseKt: number; baselineWindMaeKt: number;
  lambdaTrack: number; lambdaWind: number;
}

export interface ClassificationMetrics {
  horizon: number; n: number; accuracy: number; macroPrecision: number; macroRecall: number; macroF1: number;
  labels: string[]; matrix: number[][]; // rows = observed, cols = predicted
}

export interface TrainedModel {
  version: string;
  trainedAt: string;
  dataRetrievedAt: string;
  split: { train: [number, number]; val: [number, number]; test: [number, number] };
  nSamples: number;
  models: Record<number, { lat: Ridge; lon: Ridge; wind: Ridge }>;
  metrics: HorizonMetrics[];
  classification: ClassificationMetrics | null;
}

const LAMBDAS = [0.01, 0.1, 1, 10, 100, 1000];

export function train(storms: Storm[], dataRetrievedAt: string): TrainedModel | { error: string } {
  const samples = buildSamples(storms);
  const seasons = [...new Set(samples.map((s) => s.season))].sort((a, b) => a - b);
  if (seasons.length < 8 || samples.length < 200)
    return { error: `Insufficient official observations for training (${samples.length} samples over ${seasons.length} seasons since ${MIN_SEASON}).` };
  const nTr = Math.floor(seasons.length * 0.7), nVa = Math.floor(seasons.length * 0.15);
  const trS = seasons.slice(0, nTr), vaS = seasons.slice(nTr, nTr + nVa), teS = seasons.slice(nTr + nVa);
  const inSet = (set: number[]) => (s: Sample) => set.includes(s.season);
  const tr = samples.filter(inSet(trS)), va = samples.filter(inSet(vaS)), te = samples.filter(inSet(teS));

  const models: TrainedModel['models'] = {};
  const metrics: HorizonMetrics[] = [];
  for (const h of HORIZONS_H) {
    const has = (s: Sample) => s.targets[h] != null;
    const trH = tr.filter(has), vaH = va.filter(has), teH = te.filter(has), fullH = [...trH, ...vaH];
    if (trH.length < 50 || vaH.length < 10 || teH.length < 10) continue;
    const pick = (get: (s: Sample) => number, score: (m: Ridge) => number) => {
      let best = LAMBDAS[0], bestScore = Infinity;
      for (const l of LAMBDAS) {
        const sc = score(fitRidge(trH.map((s) => s.x), trH.map(get), l));
        if (sc < bestScore) { bestScore = sc; best = l; }
      }
      return fitRidge(fullH.map((s) => s.x), fullH.map(get), best);
    };
    const trackScore = (latM: Ridge, lonM: Ridge) => mean(vaH.map((s) => gcDistanceKm(s.lat + predictRidge(latM, s.x), s.lon + predictRidge(lonM, s.x), s.lat + s.targets[h]!.dlat, s.lon + s.targets[h]!.dlon)));
    // choose one lambda for lat/lon jointly
    let bestL = LAMBDAS[0], bestS = Infinity;
    for (const l of LAMBDAS) {
      const sc = trackScore(fitRidge(trH.map((s) => s.x), trH.map((s) => s.targets[h]!.dlat), l), fitRidge(trH.map((s) => s.x), trH.map((s) => s.targets[h]!.dlon), l));
      if (sc < bestS) { bestS = sc; bestL = l; }
    }
    const lat = fitRidge(fullH.map((s) => s.x), fullH.map((s) => s.targets[h]!.dlat), bestL);
    const lon = fitRidge(fullH.map((s) => s.x), fullH.map((s) => s.targets[h]!.dlon), bestL);
    const wind = pick((s) => s.targets[h]!.wind, (m) => mean(vaH.map((s) => Math.abs(predictRidge(m, s.x) - s.targets[h]!.wind))));
    models[h] = { lat, lon, wind };

    const k = h / 6;
    const errKm = teH.map((s) => gcDistanceKm(s.lat + predictRidge(lat, s.x), s.lon + predictRidge(lon, s.x), s.lat + s.targets[h]!.dlat, s.lon + s.targets[h]!.dlon));
    const baseKm = teH.map((s) => gcDistanceKm(s.lat + k * s.persist.dlat, s.lon + k * s.persist.dlon, s.lat + s.targets[h]!.dlat, s.lon + s.targets[h]!.dlon));
    const wErr = teH.map((s) => predictRidge(wind, s.x) - s.targets[h]!.wind);
    metrics.push({
      horizon: h, nTrain: fullH.length, nTest: teH.length,
      trackMeanKm: mean(errKm), trackRmseKm: rmse(errKm), trackP90Km: pct(errKm, 0.9),
      latMaeDeg: mean(teH.map((s) => Math.abs(predictRidge(lat, s.x) - s.targets[h]!.dlat))),
      lonMaeDeg: mean(teH.map((s) => Math.abs(predictRidge(lon, s.x) - s.targets[h]!.dlon))),
      baselineTrackMeanKm: mean(baseKm),
      windMaeKt: mean(wErr.map(Math.abs)), windRmseKt: rmse(wErr),
      baselineWindMaeKt: mean(teH.map((s) => Math.abs(s.wind - s.targets[h]!.wind))),
      lambdaTrack: bestL, lambdaWind: wind.lambda,
    });
  }
  if (!metrics.length) return { error: 'Insufficient samples at every forecast horizon.' };

  // Classification of IMD grade at +24 h from predicted wind
  let classification: ClassificationMetrics | null = null;
  const h = 24;
  if (models[h]) {
    const teH = te.filter((s) => s.targets[h]);
    const labels = IMD_SCALE.map((s) => s.code as string);
    const matrix = labels.map(() => labels.map(() => 0));
    for (const s of teH) {
      const o = labels.indexOf(imdClass(s.targets[h]!.wind)!.code);
      const p = labels.indexOf(imdClass(Math.max(0, predictRidge(models[h].wind, s.x)))!.code);
      matrix[o][p]++;
    }
    const present = labels.map((_, i) => matrix[i].reduce((a, b) => a + b, 0) + matrix.reduce((a, r) => a + r[i], 0) > 0);
    const P: number[] = [], R: number[] = [], F: number[] = [];
    labels.forEach((_, i) => {
      if (!present[i]) return;
      const tp = matrix[i][i];
      const col = matrix.reduce((a, r) => a + r[i], 0), row = matrix[i].reduce((a, b) => a + b, 0);
      const p = col ? tp / col : 0, r = row ? tp / row : 0;
      P.push(p); R.push(r); F.push(p + r ? (2 * p * r) / (p + r) : 0);
    });
    classification = {
      horizon: h, n: teH.length, accuracy: matrix.reduce((a, r, i) => a + r[i], 0) / (teH.length || 1),
      macroPrecision: mean(P), macroRecall: mean(R), macroF1: mean(F), labels, matrix,
    };
  }

  const version = `ridge-nio-${seasons[0]}-${seasons[seasons.length - 1]}-n${samples.length}`;
  return {
    version, trainedAt: new Date().toISOString(), dataRetrievedAt, nSamples: samples.length,
    split: { train: [trS[0], trS[trS.length - 1]], val: [vaS[0], vaS[vaS.length - 1]], test: [teS[0], teS[teS.length - 1]] },
    models, metrics, classification,
  };
}

export interface ForecastPoint { horizon: number; time: string; lat: number; lon: number; windKt: number; errRadiusKm: number }

export const synopticFixes = synoptic;

/** Forecast from the latest synoptic fix at or before `atT` (defaults to the last fix). */
export function forecast(model: TrainedModel, storm: Storm, atT?: number): { points: ForecastPoint[]; basis: TrackPoint } | { error: string } {
  const pts = synoptic(storm);
  let i = pts.length - 1;
  if (atT != null) while (i >= 0 && pts[i].t > atT) i--;
  const x = i >= 2 ? featuresAt(pts, i, storm.subbasin) : null;
  if (!x) return { error: 'Prediction unavailable: insufficient official observations (needs three consecutive 6-hourly IMD fixes with wind).' };
  const p0 = pts[i];
  const points: ForecastPoint[] = [];
  for (const m of model.metrics) {
    const mm = model.models[m.horizon];
    points.push({
      horizon: m.horizon, time: new Date(p0.t + m.horizon * 3600e3).toISOString(),
      lat: p0.lat + predictRidge(mm.lat, x), lon: p0.lon + predictRidge(mm.lon, x),
      windKt: Math.max(0, predictRidge(mm.wind, x)), errRadiusKm: m.trackP90Km,
    });
  }
  return { points, basis: p0 };
}
