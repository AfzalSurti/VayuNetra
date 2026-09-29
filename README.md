# VayuNetra — North Indian Ocean Cyclone Monitoring (SIH26070 prototype)

Frontend-only prototype for **SIH26070**: identification, classification, analysis and prediction of tropical cyclones over the
North Indian Ocean (Arabian Sea & Bay of Bengal). It uses **only real data retrieved at runtime** — there is no seeded data,
no mock imagery, no demo mode. When a source is unavailable, the UI says so and shows the actual error.

> Scope: this is a **frontend prototype** (React + TypeScript). Data ingestion, validation, normalisation, ML training and
> inference all run in the browser. A backend (PostgreSQL/PostGIS, MOSDAC ingestion) is **not** included — see *Limitations*.

## Stack
React 19 · TypeScript · Vite · Tailwind CSS v4 · Leaflet (react-leaflet) with OpenStreetMap · Recharts

## Quick start
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```
The dev server proxies `/proxy/ncei/*` to `https://www.ncei.noaa.gov` because the IBTrACS CSV files may not be served with
CORS headers. Production builds also use `/proxy/ncei` by default (on Vercel, `vercel.json` provides the rewrite); set
`VITE_USE_PROXY=false` to call NCEI directly, or point `VITE_IBTRACS_NI_URL` / `VITE_IBTRACS_ACTIVE_URL` at a same-origin mirror of the **unmodified**
official files. If retrieval still fails, the UI offers to load the official CSV downloaded manually from NCEI.

## Environment variables (`.env.example`)
| Variable | Used by | Notes |
|---|---|---|
| `VITE_IBTRACS_NI_URL` | frontend | optional override of the IBTrACS NI CSV URL |
| `VITE_IBTRACS_ACTIVE_URL` | frontend | optional override of the IBTrACS ACTIVE CSV URL |
| `VITE_USE_PROXY` | frontend | `false` to bypass the `/proxy/ncei` pass-through |
| `MOSDAC_USERNAME`, `MOSDAC_PASSWORD` | *future backend only* | never put these in `VITE_*` — they would be shipped to the browser |

## Data sources (details: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md))
| Source | Role in prototype | Status |
|---|---|---|
| **IMD / RSMC New Delhi best track** via **IBTrACS v04r01** (NOAA NCEI), `NEWDELHI_*` columns | cyclone tracks, intensity, pressure, grades; ML training data | connected |
| IBTrACS ACTIVE file | latest (provisional) positions of currently active NI systems | connected |
| **MOSDAC (SAC/ISRO)** INSAT-3D/3DR/3DS | satellite imagery & products | **authentication required** — shown as unavailable |
| IMD RSMC bulletins/advisories | live warnings | **not connected** (no verified public machine-readable API) |
| NASA GIBS WMTS | satellite imagery (MODIS/VIIRS true colour, MODIS TIR, GHRSST SST, IMERG) | external source, labelled |
| Open-Meteo | point SST / 10 m wind / MSL pressure at storm centre | external **model** values, labelled, not observations |

Every page has a **Data sources** panel with product, observation time, retrieval time, coverage and status. Every track fix
records whether its position came from RSMC New Delhi or the IBTrACS combined position.

## Architecture (in-browser)
```
Official file (IBTrACS NI / ACTIVE)
  └─ fetch: timeout, retry with exponential backoff, per-host rate limit, Cache Storage   (src/lib/net.ts)
      └─ validation + normalisation                                                       (src/lib/ibtracs.ts)
           header check · basin filter · main track only · UTC timestamp, not in future ·
           coordinate ranges · duplicate (SID, time) removal · wind 0–250 kt, pressure 850–1050 hPa ·
           provenance kept per fix
          └─ feature engineering → ridge models → chronological evaluation                (src/lib/ml.ts)
              └─ React context store (src/store.tsx) → pages (src/pages/*) → Leaflet GIS + Recharts
External imagery: NASA GIBS tiles (src/lib/gibs.ts) — tile load/error counts are shown on the map.
```

## Pages
Overview · Live Monitoring · Cyclone Explorer · Satellite Viewer · AI Prediction · Historical Analysis · Model Performance ·
Data Sources · System Status (includes a live API request log).

## ML pipeline (real, trained in the browser on load)
1. Retrieve IBTrACS NI; keep RSMC New Delhi fixes at synoptic hours (00/06/12/18 UTC) with wind, seasons ≥ 1990.
2. Features at time *t* (needs three consecutive 6-hourly fixes): last two 6 h displacements, lat, lon, wind, 6 h and 12 h
   wind change, month (sin/cos), Arabian-Sea flag.
3. Targets: Δlat, Δlon and wind at +6, +12, +24, +48 h (direct multi-horizon models).
4. **Chronological split by season**: first 70 % train, next 15 % validation (ridge λ selection), last 15 % test.
5. Ridge regression (closed form); final fit on train+validation.
6. Test-set metrics: great-circle track error (mean, RMSE, P90), lat/lon MAE, intensity MAE/RMSE, compared with an
   extrapolation (track) and persistence (intensity) baseline; IMD-grade classification at +24 h (accuracy, macro
   precision/recall/F1, confusion matrix).
7. Model artifact (weights, scalers, metrics) downloadable as JSON; the version string encodes data span and sample count.
8. Inference: AI Prediction page (hindcast from any fix of any storm, verified against the official track) and Live
   Monitoring (active storms). Uncertainty circles = test-set 90th-percentile track error per horizon.

**Not trained — shown as "Model unavailable":** CNN cyclone detection, ConvLSTM, satellite-based intensity estimation. They
need an INSAT imagery archive from MOSDAC. Detection precision/recall/F1 are therefore not reported.

## Limitations
- No backend, database (PostgreSQL/PostGIS), WebSocket or server-side scheduler in this prototype; browser Cache Storage
  holds retrieved official files (NI: 24 h, ACTIVE: 3 h).
- MOSDAC and IMD live-bulletin integrations are not implemented (authentication / no verified API). They are shown as
  unavailable rather than substituted.
- IBTrACS ACTIVE data is provisional and not an IMD real-time feed; the app never labels it "real-time".
- NASA GIBS imagery is daily polar-orbiter composites, not geostationary INSAT imagery.
- The ridge model is a transparent statistical baseline, not an operational forecast.
- The NI CSV is large; the first load can take a while on slow connections.

## Deployment

### Vercel (recommended)
1. Push this repo to GitHub (already done).
2. Go to https://vercel.com/new → **Import Git Repository** → pick `VayuNetra`.
3. Vercel detects **Vite** from `vercel.json`; keep Build Command `npm run build` and Output Directory `dist`.
4. Environment variables: none required. Never add MOSDAC credentials as `VITE_*` variables.
5. Click **Deploy**. Every push to the branch creates a preview deployment; merges to `main` go to production.

Or from a terminal: `npm i -g vercel && vercel` (preview) then `vercel --prod`.

`vercel.json` rewrites `/proxy/ncei/*` → `https://www.ncei.noaa.gov/*` so the browser can read the IBTrACS CSV files
without CORS problems. If the proxied download fails (e.g. size/time limits), the app shows the error and offers to load
the official CSV from disk.

### Other static hosts
`npm run build` and serve `dist/`, with an equivalent `/proxy/ncei` pass-through, or build with `VITE_USE_PROXY=false`.

## Licensing / attribution
- IBTrACS: cite Knapp et al. (2010), BAMS 91, 363–376, and the IBTrACS v04 dataset (NOAA NCEI). RSMC New Delhi (IMD) is the
  originating agency of the `NEWDELHI_*` values.
- Map data © OpenStreetMap contributors (ODbL).
- NASA GIBS imagery: acknowledge NASA EOSDIS GIBS.
- Open-Meteo: follow its attribution terms.
- MOSDAC/IMD data, when connected through a future backend, are subject to their own terms of use.
