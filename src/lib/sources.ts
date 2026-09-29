// Registry of data sources the prototype knows about, and whether this
// frontend-only build can actually access them. Nothing here is a data value.

export type AccessState = 'connected' | 'auth-required' | 'backend-required' | 'external';

export interface SourceDef {
  id: string;
  name: string;
  organization: string;
  official: 'indian-official' | 'international-official' | 'external';
  homepage: string;
  products: string;
  access: AccessState;
  note: string;
}

const env = import.meta.env;
export const IBTRACS_BASE = '/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/';
// Requests go through a same-origin pass-through (/proxy/ncei): the Vite proxy in dev/preview,
// the rewrite in vercel.json on Vercel. Set VITE_USE_PROXY=false to call NCEI directly.
const nceiPrefix = env.VITE_USE_PROXY === 'false' ? 'https://www.ncei.noaa.gov' : '/proxy/ncei';
export const IBTRACS_URLS = {
  NI: env.VITE_IBTRACS_NI_URL || `${nceiPrefix}${IBTRACS_BASE}ibtracs.NI.list.v04r01.csv`,
  ACTIVE: env.VITE_IBTRACS_ACTIVE_URL || `${nceiPrefix}${IBTRACS_BASE}ibtracs.ACTIVE.list.v04r01.csv`,
};
export const IBTRACS_ORIGIN_URLS = {
  NI: `https://www.ncei.noaa.gov${IBTRACS_BASE}ibtracs.NI.list.v04r01.csv`,
  ACTIVE: `https://www.ncei.noaa.gov${IBTRACS_BASE}ibtracs.ACTIVE.list.v04r01.csv`,
};

export const SOURCES: SourceDef[] = [
  {
    id: 'mosdac',
    name: 'MOSDAC',
    organization: 'Space Applications Centre, ISRO',
    official: 'indian-official',
    homepage: 'https://www.mosdac.gov.in/',
    products: 'INSAT-3D / 3DR / 3DS imager & sounder products (IR, WV, VIS, QPE, SST, CMV, UTH, …)',
    access: 'auth-required',
    note: 'Authentication required for this official dataset. MOSDAC data download requires a registered user account; credentials must never be placed in a browser app, so this integration belongs in a backend ingestion service (not part of this frontend-only prototype).',
  },
  {
    id: 'imd-rsmc',
    name: 'IMD / RSMC New Delhi',
    organization: 'India Meteorological Department',
    official: 'indian-official',
    homepage: 'https://rsmcnewdelhi.imd.gov.in/',
    products: 'Cyclone bulletins, advisories, best-track data',
    access: 'backend-required',
    note: 'No documented public JSON/CORS API could be verified for direct browser access. RSMC New Delhi best-track values are consumed here via the NEWDELHI_* columns of IBTrACS (see below). Live bulletins require a backend ingestion service.',
  },
  {
    id: 'ibtracs',
    name: 'IBTrACS v04r01',
    organization: 'NOAA NCEI (WMO-endorsed archive; includes RSMC New Delhi best track)',
    official: 'international-official',
    homepage: 'https://www.ncei.noaa.gov/products/international-best-track-archive',
    products: 'North Indian basin track file (ibtracs.NI.list.v04r01.csv) and ACTIVE storms file',
    access: 'connected',
    note: 'Positions, wind and pressure are taken from the NEWDELHI_* (RSMC New Delhi / IMD) columns. Rows without IMD values are excluded from IMD-based analysis.',
  },
  {
    id: 'gibs',
    name: 'NASA GIBS (WMTS)',
    organization: 'NASA Earthdata / ESDIS',
    official: 'external',
    homepage: 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api',
    products: 'MODIS/VIIRS true colour, GHRSST MUR SST, IMERG precipitation tiles',
    access: 'external',
    note: 'External (non-Indian) satellite imagery used because MOSDAC INSAT imagery needs authenticated backend access.',
  },
  {
    id: 'open-meteo',
    name: 'Open-Meteo Marine & Forecast APIs',
    organization: 'Open-Meteo',
    official: 'external',
    homepage: 'https://open-meteo.com/',
    products: 'Point sea-surface temperature, 10 m wind, MSL pressure (model-based)',
    access: 'external',
    note: 'External, model-derived values — NOT official observations. Shown only as environmental context and labelled as such.',
  },
];
