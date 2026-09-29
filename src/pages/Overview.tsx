import { useMemo, useState } from 'react';
import { useData } from '../store';
import { TrackMap, ImdLegend } from '../components/TrackMap';
import { Card, DataSources, Stat, Badge, fmtTime } from '../components/ui';
import { DatasetGate } from '../components/DatasetGate';
import { StormPanel } from '../components/StormPanel';
import type { Storm } from '../lib/ibtracs';
import { SOURCES } from '../lib/sources';

export default function Overview() {
  const { ni, active, model } = useData();
  const [sel, setSel] = useState<Storm | null>(null);
  const maxSeason = useMemo(() => Math.max(0, ...ni.storms.map((s) => s.season)), [ni.storms]);
  const recent = useMemo(() => ni.storms.filter((s) => s.season >= maxSeason - 2), [ni.storms, maxSeason]);
  const seasons = useMemo(() => new Set(ni.storms.map((s) => s.season)), [ni.storms]);
  const activeNi = active.storms;
  const selected = sel ?? activeNi[0] ?? recent[0] ?? null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Storms in archive (NI)" value={ni.status === 'ok' ? ni.storms.length : '—'} sub={ni.status === 'ok' ? `${Math.min(...seasons)}–${Math.max(...seasons)}` : ni.status} />
        <Stat label="Storms with IMD fixes" value={ni.status === 'ok' ? ni.storms.filter((s) => s.points.some((p) => p.posSource === 'NEWDELHI')).length : '—'} />
        <Stat label="Active NIO systems" value={active.status === 'ok' ? activeNi.length : '—'} sub={active.status === 'ok' ? 'IBTrACS ACTIVE (provisional)' : active.status} />
        <Stat label="ML model" value={model.status} sub={model.model?.version ?? model.reason?.slice(0, 60)} />
        <Stat label="MOSDAC INSAT feed" value="—" sub="Authentication required" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
        <Card title={`Tracks — last three seasons in archive (${maxSeason ? `${maxSeason - 2}–${maxSeason}` : '—'})`} right={<ImdLegend />}>
          <DatasetGate ds={ni}>
            <TrackMap storms={[...recent, ...activeNi]} selected={selected} onSelect={setSel} showRegions className="h-[520px]" />
          </DatasetGate>
        </Card>
        <Card title="Selected cyclone">
          {selected ? <StormPanel storm={selected} sourceLabel="RSMC New Delhi best track via IBTrACS v04r01 (NOAA NCEI)" /> : <div className="text-sm text-slate-500">No storm loaded.</div>}
          <div className="mt-3 space-y-1 text-xs text-slate-400">
            <div className="flex items-center gap-2"><Badge tag="official" /> track fixes from RSMC New Delhi</div>
            <div className="flex items-center gap-2"><Badge tag="ml" /> see AI Prediction page</div>
          </div>
        </Card>
      </div>

      <DataSources rows={[
        { source: 'NOAA NCEI – IBTrACS v04r01 (RSMC New Delhi columns)', product: 'ibtracs.NI.list.v04r01.csv', url: ni.officialUrl, observation: ni.storms[0] ? fmtTime(ni.storms[0].end) : undefined, retrieved: fmtTime(ni.retrievedAt), coverage: 'North Indian Ocean', status: ni.status === 'ok' ? <Badge tag="official" label={`Official data (${ni.via})`} /> : <Badge tag="unavailable" label={ni.status} /> },
        { source: 'NOAA NCEI – IBTrACS v04r01', product: 'ibtracs.ACTIVE.list.v04r01.csv', url: active.officialUrl, retrieved: fmtTime(active.retrievedAt), coverage: 'Filtered to basin NI', status: active.status === 'ok' ? <Badge tag="official" label="Provisional" /> : <Badge tag="unavailable" label={active.status} /> },
        ...SOURCES.filter((s) => s.access === 'auth-required' || s.access === 'backend-required').map((s) => ({ source: `${s.name} – ${s.organization}`, product: s.products, url: s.homepage, status: <Badge tag={s.access === 'auth-required' ? 'auth' : 'unavailable'} label={s.access === 'auth-required' ? undefined : 'Not connected'} /> })),
      ]} />
    </div>
  );
}
