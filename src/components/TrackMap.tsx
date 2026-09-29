import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Circle, Tooltip, Rectangle, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import type { Storm } from '../lib/ibtracs';
import { imdClass, REGIONS } from '../lib/geo';
import { gibsUrl, type GibsLayer } from '../lib/gibs';
import type { ForecastPoint } from '../lib/ml';
import { fmtTime } from './ui';

export interface Overlay { layer: GibsLayer; date: string; opacity?: number }

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  const key = JSON.stringify(bounds);
  useEffect(() => { map.fitBounds(bounds); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function TrackMap({
  storms = [], selected, onSelect, forecast, basis, overlay, bounds = REGIONS.NIO.bounds, className = 'h-[480px]', showRegions = false, onOverlayStatus,
}: {
  storms?: Storm[];
  selected?: Storm | null;
  onSelect?: (s: Storm) => void;
  forecast?: ForecastPoint[];
  basis?: { lat: number; lon: number } | null;
  overlay?: Overlay | null;
  bounds?: LatLngBoundsExpression;
  className?: string;
  showRegions?: boolean;
  onOverlayStatus?: (s: { loaded: number; failed: number }) => void;
}) {
  const [tiles, setTiles] = useState({ loaded: 0, failed: 0 });
  const overlayKey = overlay ? `${overlay.layer.id}/${overlay.date}` : '';
  useEffect(() => { setTiles({ loaded: 0, failed: 0 }); }, [overlayKey]);
  useEffect(() => { onOverlayStatus?.(tiles); }, [tiles, onOverlayStatus]);

  const lines = useMemo(() => storms.filter((s) => s.sid !== selected?.sid).map((s) => ({
    s, pos: s.points.map((p) => [p.lat, p.lon] as [number, number]), color: imdClass(s.maxWindKt)?.color ?? '#475569',
  })), [storms, selected]);

  return (
    <div className={`relative overflow-hidden rounded border border-slate-800 ${className}`}>
      <MapContainer center={[15, 80]} zoom={4} minZoom={2} maxZoom={10} worldCopyJump className="h-full w-full">
        <FitBounds bounds={bounds} />
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={overlay ? 0.35 : 0.8} />
        {overlay && (
          <TileLayer
            key={overlayKey}
            url={gibsUrl(overlay.layer, overlay.date)}
            maxNativeZoom={overlay.layer.maxZoom}
            maxZoom={10}
            opacity={overlay.opacity ?? 0.85}
            attribution='Imagery: <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>'
            eventHandlers={{
              tileload: () => setTiles((t) => ({ ...t, loaded: t.loaded + 1 })),
              tileerror: () => setTiles((t) => ({ ...t, failed: t.failed + 1 })),
            }}
          />
        )}
        {showRegions && (['AS', 'BB'] as const).map((k) => (
          <Rectangle key={k} bounds={REGIONS[k].bounds} pathOptions={{ color: '#64748b', weight: 1, dashArray: '4 4', fill: false }}>
            <Tooltip sticky>{REGIONS[k].name} (display extent)</Tooltip>
          </Rectangle>
        ))}
        {lines.map(({ s, pos, color }) => (
          <Polyline key={s.sid} positions={pos} pathOptions={{ color, weight: 1.5, opacity: 0.6 }} eventHandlers={{ click: () => onSelect?.(s) }}>
            <Tooltip sticky>{s.name} ({s.season}) — peak {s.maxWindKt ?? '—'} kt [{imdClass(s.maxWindKt)?.code ?? 'n/a'}] · IMD/RSMC New Delhi via IBTrACS</Tooltip>
          </Polyline>
        ))}
        {selected && (
          <>
            <Polyline positions={selected.points.map((p) => [p.lat, p.lon] as [number, number])} pathOptions={{ color: '#e2e8f0', weight: 3 }} />
            {selected.points.map((p) => (
              <CircleMarker key={p.t} center={[p.lat, p.lon]} radius={4} pathOptions={{ color: '#0f172a', weight: 1, fillColor: imdClass(p.windKt)?.color ?? '#94a3b8', fillOpacity: 1 }}>
                <Tooltip>
                  <b>Official observation</b> — {selected.name}<br />{fmtTime(p.time)}<br />
                  {p.lat.toFixed(1)}, {p.lon.toFixed(1)} · {p.windKt ?? '—'} kt · {p.presHpa ?? '—'} hPa<br />
                  Grade: {p.grade ?? '—'} · position: {p.posSource === 'NEWDELHI' ? 'RSMC New Delhi' : 'IBTrACS combined'}
                </Tooltip>
              </CircleMarker>
            ))}
          </>
        )}
        {forecast && basis && forecast.length > 0 && (
          <>
            <Polyline positions={[[basis.lat, basis.lon], ...forecast.map((f) => [f.lat, f.lon] as [number, number])]} pathOptions={{ color: '#a78bfa', weight: 3, dashArray: '6 6' }} />
            {forecast.map((f) => (
              <Circle key={`c${f.horizon}`} center={[f.lat, f.lon]} radius={f.errRadiusKm * 1000} pathOptions={{ color: '#a78bfa', weight: 1, fillOpacity: 0.06 }} />
            ))}
            {forecast.map((f) => (
              <CircleMarker key={f.horizon} center={[f.lat, f.lon]} radius={5} pathOptions={{ color: '#a78bfa', fillColor: '#1e1b4b', fillOpacity: 1 }}>
                <Tooltip><b>AI/ML prediction</b> +{f.horizon} h<br />{fmtTime(f.time)}<br />{f.lat.toFixed(2)}, {f.lon.toFixed(2)} · {f.windKt.toFixed(0)} kt<br />90% empirical error radius: {f.errRadiusKm.toFixed(0)} km</Tooltip>
              </CircleMarker>
            ))}
          </>
        )}
      </MapContainer>
      {overlay && (
        <div className="pointer-events-none absolute bottom-1 left-1 z-[1000] rounded bg-slate-950/85 px-2 py-1 text-[10px] text-slate-300">
          {overlay.layer.satellite} · {overlay.layer.product} · {overlay.date} · NASA GIBS (external) · tiles ok {tiles.loaded} / failed {tiles.failed}
        </div>
      )}
    </div>
  );
}

export function ImdLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
      {[['D', '#38bdf8'], ['DD', '#22d3ee'], ['CS', '#facc15'], ['SCS', '#fb923c'], ['VSCS', '#f97316'], ['ESCS', '#ef4444'], ['SuCS', '#c026d3']].map(([c, col]) => (
        <span key={c} className="flex items-center gap-1"><span className="inline-block h-2 w-3" style={{ background: col }} />{c}</span>
      ))}
      <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-violet-400" />AI/ML forecast</span>
    </div>
  );
}
