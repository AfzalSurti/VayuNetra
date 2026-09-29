# Data sources

Only information that is part of the implementation or publicly documented by the provider is listed. The build
environment had no outbound access to these hosts, so details that could not be checked against the provider's current
documentation are marked **"Not verified"** instead of guessed.

| Source | Organization | Dataset / Product | API / Access method | Purpose | Authentication | Update frequency | License / usage restrictions |
|---|---|---|---|---|---|---|---|
| MOSDAC | Space Applications Centre, ISRO | INSAT-3D / 3DR / 3DS imager & derived products | Portal https://www.mosdac.gov.in/ — programmatic interface **not verified** | Satellite imagery, QPE, SST, CMV, UTH | Registered user account required | Not verified | MOSDAC terms of use — Not verified |
| IMD / RSMC New Delhi | India Meteorological Department | Cyclone bulletins, advisories, best track | https://rsmcnewdelhi.imd.gov.in/ (web pages); machine-readable API **not verified** | Official warnings; best track | Not verified | Not verified | IMD terms — Not verified |
| IBTrACS v04r01 (NI) | NOAA NCEI (WMO-endorsed archive; includes RSMC New Delhi) | `ibtracs.NI.list.v04r01.csv` | HTTPS file download from https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ | Historical tracks, intensity, pressure (`NEWDELHI_*` columns); ML training | None | Not verified | Cite Knapp et al. 2010 and IBTrACS v04 — other terms Not verified |
| IBTrACS v04r01 (ACTIVE) | NOAA NCEI | `ibtracs.ACTIVE.list.v04r01.csv` | Same directory as above | Latest provisional positions of active storms | None | Not verified | As above |
| NASA GIBS | NASA EOSDIS / ESDIS | MODIS Terra/Aqua & VIIRS SNPP Corrected Reflectance, MODIS Band 31 brightness temperature, GHRSST MUR L4 SST, IMERG precipitation rate | WMTS REST tiles `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/{tms}/{z}/{y}/{x}.{ext}` | External satellite context imagery | None | Per layer — Not verified | Acknowledge NASA GIBS — Not verified |
| Open-Meteo | Open-Meteo | Marine API `sea_surface_temperature`; Forecast API `wind_speed_10m`, `pressure_msl` | JSON REST `https://marine-api.open-meteo.com/v1/marine`, `https://api.open-meteo.com/v1/forecast` | External model context at storm centre (not observations) | None | Not verified | Attribution required — Not verified |
| OpenStreetMap | OpenStreetMap Foundation | Standard tile layer | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Base map | None | — | ODbL; OSM tile usage policy applies |

data.gov.in and other Indian Government sources were not integrated: no dataset relevant to cyclone tracks or satellite
products was verified during this prototype.
