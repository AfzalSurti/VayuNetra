// NASA GIBS WMTS (REST) layer catalogue used for satellite imagery.
// Tile URL template: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{Layer}/default/{Time}/{TileMatrixSet}/{z}/{y}/{x}.{ext}
// Availability of a layer for a given date is decided by GIBS; failed tiles are counted and reported in the UI.

export interface GibsLayer {
  id: string;
  satellite: string;
  product: string;
  tms: string;
  ext: 'jpg' | 'png';
  maxZoom: number;
  kind: 'visible' | 'infrared' | 'sst' | 'precip';
  note: string;
}

export const GIBS_LAYERS: GibsLayer[] = [
  { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', satellite: 'Terra (MODIS)', product: 'Corrected Reflectance – True Colour (VIS)', tms: 'GoogleMapsCompatible_Level9', ext: 'jpg', maxZoom: 9, kind: 'visible', note: 'Daily daytime mosaic (~10:30 local overpass).' },
  { id: 'MODIS_Aqua_CorrectedReflectance_TrueColor', satellite: 'Aqua (MODIS)', product: 'Corrected Reflectance – True Colour (VIS)', tms: 'GoogleMapsCompatible_Level9', ext: 'jpg', maxZoom: 9, kind: 'visible', note: 'Daily daytime mosaic (~13:30 local overpass).' },
  { id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', satellite: 'Suomi NPP (VIIRS)', product: 'Corrected Reflectance – True Colour (VIS)', tms: 'GoogleMapsCompatible_Level9', ext: 'jpg', maxZoom: 9, kind: 'visible', note: 'Daily daytime mosaic.' },
  { id: 'MODIS_Terra_Brightness_Temp_Band31_Day', satellite: 'Terra (MODIS)', product: 'Brightness Temperature Band 31 (TIR, day)', tms: 'GoogleMapsCompatible_Level7', ext: 'png', maxZoom: 7, kind: 'infrared', note: 'Thermal infrared (~11 µm).' },
  { id: 'GHRSST_L4_MUR_Sea_Surface_Temperature', satellite: 'Multi-sensor (GHRSST MUR L4)', product: 'Sea Surface Temperature', tms: 'GoogleMapsCompatible_Level7', ext: 'png', maxZoom: 7, kind: 'sst', note: 'Daily gap-free analysis; typically published with a delay of about a day.' },
  { id: 'IMERG_Precipitation_Rate', satellite: 'GPM constellation (IMERG)', product: 'Precipitation Rate', tms: 'GoogleMapsCompatible_Level6', ext: 'png', maxZoom: 6, kind: 'precip', note: 'Satellite precipitation estimate.' },
];

export const gibsUrl = (l: GibsLayer, date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.id}/default/${date}/${l.tms}/{z}/{y}/{x}.${l.ext}`;

export const MOSDAC_PRODUCTS = [
  { satellite: 'INSAT-3D', products: ['Imager VIS', 'SWIR', 'MIR', 'TIR-1', 'TIR-2', 'Water Vapour', 'QPE (HEM/IMR)', 'SST', 'Cloud Motion Vector', 'Water Vapour Wind', 'UTH'] },
  { satellite: 'INSAT-3DR', products: ['Imager VIS', 'SWIR', 'MIR', 'TIR-1', 'TIR-2', 'Water Vapour', 'QPE', 'SST', 'Cloud Motion Vector', 'Water Vapour Wind', 'UTH'] },
  { satellite: 'INSAT-3DS', products: ['Imager VIS', 'SWIR', 'MIR', 'TIR-1', 'TIR-2', 'Water Vapour', 'QPE', 'SST', 'Cloud Motion Vector', 'Water Vapour Wind', 'UTH'] },
];

export function utcDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400e3);
  return d.toISOString().slice(0, 10);
}
