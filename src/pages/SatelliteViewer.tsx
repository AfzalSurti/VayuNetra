import { useCallback, useMemo, useState } from 'react';
import { useData } from '../store';
import { TrackMap } from '../components/TrackMap';
import { Badge, Card, DataSources, Select, Unavailable } from '../components/ui';
import { GIBS_LAYERS, MOSDAC_PRODUCTS, utcDate } from '../lib/gibs';
import { REGIONS } from '../lib/geo';

export default function SatelliteViewer() {
  const { ni } = useData();
  const sats = useMemo(() => [...MOSDAC_PRODUCTS.map((m) => `MOSDAC:${m.satellite}`), ...new Set(GIBS_LAYERS.map((l) => `GIBS:${l.satellite}`))], []);
  const [sat, setSat] = useState(`GIBS:${GIBS_LAYERS[2].satellite}`);
  const isMosdac = sat.startsWith('MOSDAC:');
  const products = isMosdac ? MOSDAC_PRODUCTS.find((m) => `MOSDAC:${m.satellite}` === sat)!.products.map((p) => ({ value: p, label: p }))
    : GIBS_LAYERS.filter((l) => `GIBS:${l.satellite}` === sat).map((l) => ({ value: l.id, label: l.product }));
  const [prod, setProd] = useState(products[0].value);
  const product = products.find((p) => p.value === prod) ? prod : products[0].value;
  const [date, setDate] = useState(utcDate(-1));
  const [region, setRegion] = useState<keyof typeof REGIONS>('NIO');
  const [tiles, setTiles] = useState({ loaded: 0, failed: 0 });
  const onStatus = useCallback((s: { loaded: number; failed: number }) => setTiles(s), []);
  const layer = GIBS_LAYERS.find((l) => l.id === product);
  // storms observed on the selected date (official tracks overlay)
  const dayStorms = useMemo(() => ni.storms.filter((s) => s.start.slice(0, 10) <= date && s.end.slice(0, 10) >= date), [ni.storms, date]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Satellite" value={sat} onChange={setSat} options={sats.map((s) => ({ value: s, label: s.replace('MOSDAC:', 'ISRO ').replace('GIBS:', '') + (s.startsWith('MOSDAC') ? ' — auth required' : ' — NASA GIBS') }))} />
        <Select label="Product" value={product} onChange={setProd} options={products} />
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-slate-500">Date (UTC)
          <input type="date" className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200" value={date} max={utcDate(0)} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-slate-500">Time
          <input disabled value={isMosdac ? '—' : 'Daily composite'} className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-sm text-slate-500" />
        </label>
        <Select label="Region" value={region} onChange={setRegion} options={Object.entries(REGIONS).map(([k, v]) => ({ value: k as keyof typeof REGIONS, label: v.name }))} />
      </div>
      {isMosdac ? (
        <Unavailable tag="auth" title="Authentication required for this official dataset." reason={<>{sat.replace('MOSDAC:', '')} {product} is distributed by MOSDAC (SAC/ISRO) to registered users. Connecting it requires a backend ingestion service holding MOSDAC credentials (MOSDAC_USERNAME / MOSDAC_PASSWORD) and the documented MOSDAC download interface. No image is shown because none was retrieved. <a className="text-sky-400 underline" href="https://www.mosdac.gov.in/" target="_blank" rel="noreferrer">mosdac.gov.in</a></>} />
      ) : layer && (
        <Card title={`${layer.satellite} — ${layer.product} — ${date}`} right={<Badge tag="external" label="External: NASA GIBS" />}>
          {tiles.loaded === 0 && tiles.failed > 0 && <div className="mb-2"><Unavailable title="No imagery returned" reason={`GIBS returned errors for all ${tiles.failed} requested tiles for ${layer.id} on ${date}. The product may not yet be published for this date, or the service is unreachable.`} /></div>}
          <TrackMap storms={dayStorms} overlay={{ layer, date, opacity: 1 }} bounds={REGIONS[region].bounds} className="h-[600px]" onOverlayStatus={onStatus} />
          <div className="mt-2 text-xs text-slate-500">{layer.note} Tracks drawn: official IMD/RSMC New Delhi tracks of systems active on {date} ({dayStorms.length}).</div>
        </Card>
      )}
      <DataSources rows={[
        isMosdac
          ? { source: 'MOSDAC – SAC/ISRO', product: `${sat.replace('MOSDAC:', '')} ${product}`, url: 'https://www.mosdac.gov.in/', status: <Badge tag="auth" /> }
          : { source: 'NASA GIBS WMTS', product: layer?.id ?? '', url: 'https://nasa-gibs.github.io/gibs-api-docs/', observation: date, retrieved: `${tiles.loaded} tiles ok / ${tiles.failed} failed`, coverage: REGIONS[region].name, status: <Badge tag="external" /> },
      ]} />
    </div>
  );
}
