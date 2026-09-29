import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../store';
import { Badge, Card, DataSources, Unavailable, fmtTime } from '../components/ui';
import { FEATURE_NAMES } from '../lib/ml';

const axis = { stroke: '#64748b', fontSize: 11 };
const tip = { contentStyle: { background: '#0f172a', border: '1px solid #334155', fontSize: 12 } };

export default function ModelPerformance() {
  const { model, ni } = useData();
  const m = model.model;
  const download = () => {
    if (!m) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(m, null, 1)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `${m.version}.json` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <Card title="Model registry">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500"><tr><th className="py-1">Model</th><th>Task</th><th>Status</th><th>Details</th></tr></thead>
          <tbody>
            <tr className="border-t border-slate-800"><td className="py-1 font-mono">{m?.version ?? 'ridge-nio'}</td><td>Track (6–48 h) + intensity regression, IMD grade classification</td><td>{m ? <Badge tag="ml" label="Trained" /> : <Badge tag="unavailable" label={model.status} />}</td><td>{m ? `Trained ${fmtTime(m.trainedAt)} on ${m.nSamples} samples` : model.reason}</td></tr>
            <tr className="border-t border-slate-800"><td className="py-1">CNN cloud/storm feature extractor</td><td>Cyclone detection from INSAT IR imagery</td><td><Badge tag="unavailable" label="Model unavailable" /></td><td>Not trained: requires labelled INSAT-3D/3DR imagery archive from MOSDAC (authenticated).</td></tr>
            <tr className="border-t border-slate-800"><td className="py-1">ConvLSTM spatiotemporal model</td><td>Cloud-field evolution / track</td><td><Badge tag="unavailable" label="Model unavailable" /></td><td>Not trained: requires INSAT image sequences.</td></tr>
            <tr className="border-t border-slate-800"><td className="py-1">Satellite intensity estimator</td><td>Dvorak-like intensity from IR</td><td><Badge tag="unavailable" label="Model unavailable" /></td><td>Not trained: requires INSAT imagery matched to IMD best track.</td></tr>
          </tbody>
        </table>
        <div className="mt-2 text-xs text-slate-500">Cyclone <i>detection</i> precision/recall/F1 cannot be reported: no detection model exists without satellite imagery.</div>
      </Card>

      {!m ? <Unavailable title="Model unavailable" reason={model.reason ?? `Status: ${model.status}`} /> : (
        <>
          <Card title="Training configuration" right={<button onClick={download} className="rounded border border-slate-600 px-2 py-0.5 text-xs hover:bg-slate-800">Download model artifact (JSON)</button>}>
            <div className="grid gap-1 text-xs text-slate-300 md:grid-cols-2">
              <div>Data: RSMC New Delhi 6-hourly fixes (IBTrACS NI), retrieved {fmtTime(m.dataRetrievedAt)}</div>
              <div>Chronological split by season — train {m.split.train.join('–')}, validation {m.split.val.join('–')}, test {m.split.test.join('–')}</div>
              <div>Final fit on train+validation after λ selection on validation; metrics on test seasons only.</div>
              <div>Features: {FEATURE_NAMES.join(', ')}</div>
              <div>Baselines: linear extrapolation of last 6 h motion (track); persistence (intensity).</div>
            </div>
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Track error on test seasons (great-circle km)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={m.metrics.map((x) => ({ h: `+${x.horizon} h`, model: +x.trackMeanKm.toFixed(1), baseline: +x.baselineTrackMeanKm.toFixed(1) }))}>
                  <CartesianGrid stroke="#1e293b" /><XAxis dataKey="h" {...axis} /><YAxis {...axis} /><Tooltip {...tip} /><Legend />
                  <Bar dataKey="model" name="Ridge model – mean error" fill="#a78bfa" /><Bar dataKey="baseline" name="Extrapolation baseline" fill="#475569" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Intensity MAE on test seasons (kt)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={m.metrics.map((x) => ({ h: `+${x.horizon} h`, model: +x.windMaeKt.toFixed(2), baseline: +x.baselineWindMaeKt.toFixed(2) }))}>
                  <CartesianGrid stroke="#1e293b" /><XAxis dataKey="h" {...axis} /><YAxis {...axis} /><Tooltip {...tip} /><Legend />
                  <Bar dataKey="model" name="Ridge model" fill="#a78bfa" /><Bar dataKey="baseline" name="Persistence" fill="#475569" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
          <Card title="Metrics table (test set)">
            <div className="overflow-x-auto">
              <table className="num w-full text-left text-xs">
                <thead className="text-slate-500"><tr><th className="py-1">Horizon</th><th>n train+val</th><th>n test</th><th>Track mean</th><th>Track RMSE</th><th>Track P90</th><th>Lat MAE</th><th>Lon MAE</th><th>Baseline mean</th><th>Wind MAE</th><th>Wind RMSE</th><th>Persistence MAE</th><th>λ track / wind</th></tr></thead>
                <tbody>{m.metrics.map((x) => (
                  <tr key={x.horizon} className="border-t border-slate-800"><td className="py-1">+{x.horizon} h</td><td>{x.nTrain}</td><td>{x.nTest}</td><td>{x.trackMeanKm.toFixed(1)} km</td><td>{x.trackRmseKm.toFixed(1)} km</td><td>{x.trackP90Km.toFixed(1)} km</td><td>{x.latMaeDeg.toFixed(3)}°</td><td>{x.lonMaeDeg.toFixed(3)}°</td><td>{x.baselineTrackMeanKm.toFixed(1)} km</td><td>{x.windMaeKt.toFixed(2)} kt</td><td>{x.windRmseKt.toFixed(2)} kt</td><td>{x.baselineWindMaeKt.toFixed(2)} kt</td><td>{x.lambdaTrack} / {x.lambdaWind}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
          {m.classification && (
            <Card title={`IMD grade classification at +${m.classification.horizon} h (from predicted intensity), test n=${m.classification.n}`}>
              <div className="mb-2 flex flex-wrap gap-4 text-sm num">
                <span>Accuracy {(100 * m.classification.accuracy).toFixed(1)}%</span>
                <span>Macro precision {(100 * m.classification.macroPrecision).toFixed(1)}%</span>
                <span>Macro recall {(100 * m.classification.macroRecall).toFixed(1)}%</span>
                <span>Macro F1 {(100 * m.classification.macroF1).toFixed(1)}%</span>
              </div>
              <div className="overflow-x-auto">
                <table className="num text-center text-xs">
                  <thead><tr><th className="p-1 text-left text-slate-500">obs ↓ / pred →</th>{m.classification.labels.map((l) => <th key={l} className="p-1 text-slate-400">{l}</th>)}</tr></thead>
                  <tbody>{m.classification.matrix.map((row, i) => {
                    const max = Math.max(1, ...m.classification!.matrix.flat());
                    return (
                      <tr key={i}><th className="p-1 text-left text-slate-400">{m.classification!.labels[i]}</th>
                        {row.map((v, j) => <td key={j} className="h-8 w-12 border border-slate-800" style={{ background: v ? `rgba(167,139,250,${0.15 + (0.85 * v) / max})` : undefined }}>{v || ''}</td>)}
                      </tr>);
                  })}</tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
      <DataSources rows={[{ source: 'IBTrACS v04r01 – RSMC New Delhi columns', product: 'Training/test data', url: ni.officialUrl, retrieved: fmtTime(ni.retrievedAt), status: ni.status === 'ok' ? <Badge tag="official" /> : <Badge tag="unavailable" label={ni.status} /> }]} />
    </div>
  );
}
