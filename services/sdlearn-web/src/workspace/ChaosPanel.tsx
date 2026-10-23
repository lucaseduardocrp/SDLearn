import { useMemo, useState } from 'react';
import { Bomb, Crosshair, Dices, Eraser, Flame, Scissors, ShieldCheck, Snail, Skull, TrendingUp, TriangleAlert } from 'lucide-react';
import { chaosScenarios, formatRate } from '@shared/engine/chaos';
import { Button } from '../components/ui';
import { useI18n } from '../i18n';
import type { ChaosRequest, ChaosResult, ChaosRun, ChaosScenarioId } from '../types';
import { relativeTime } from '../lib/format';

const scenarioIcons: Record<ChaosScenarioId, typeof Bomb> = {
  'node-failure': Skull, 'replica-loss': Flame, 'network-partition': Scissors, 'traffic-spike': TrendingUp, 'latency-injection': Snail, 'chaos-monkey': Dices,
};
const outcomeIcons: Record<ChaosResult['outcome'], typeof Bomb> = { survived: ShieldCheck, degraded: TriangleAlert, outage: Bomb };

interface ChaosPanelProps {
  selection: { nodeId?: string; edgeId?: string; label?: string };
  result: ChaosResult | null;
  runs: ChaosRun[];
  running: boolean;
  error: string | null;
  onRun: (request: ChaosRequest) => void;
  onClear: () => void;
  onShowRun: (run: ChaosRun) => void;
}

export function ChaosPanel({ selection, result, runs, running, error, onRun, onClear, onShowRun }: ChaosPanelProps) {
  const { t, locale } = useI18n();
  const scenarios = useMemo(() => chaosScenarios(locale), [locale]);
  const [scenarioId, setScenarioId] = useState<ChaosScenarioId>('node-failure');
  const scenario = scenarios.find((item) => item.id === scenarioId)!;
  const [magnitudes, setMagnitudes] = useState<Record<string, number>>({});
  const magnitude = scenario.magnitude ? magnitudes[scenario.id] ?? scenario.magnitude.default : undefined;
  const targetId = scenario.target === 'node' ? selection.nodeId : scenario.target === 'edge' ? selection.edgeId : undefined;
  const missingTarget = scenario.target !== 'none' && !targetId;

  return (
    <div className="chaos-panel">
      <div className="scenario-list" role="radiogroup" aria-label={t.chaos.scenarioGroup}>
        {scenarios.map((item) => {
          const Icon = scenarioIcons[item.id];
          return (
            <button key={item.id} role="radio" aria-checked={item.id === scenarioId} className={`scenario${item.id === scenarioId ? ' active' : ''}`} onClick={() => setScenarioId(item.id)} title={item.description}>
              <Icon size={15} /><span>{item.name}</span>
            </button>
          );
        })}
      </div>
      <p className="muted small">{scenario.description}</p>

      {scenario.target !== 'none' && (
        <div className={`target-box${missingTarget ? ' missing' : ''}`}>
          <Crosshair size={14} />
          <span>{missingTarget ? t.chaos.pickTarget(scenario.target === 'node' ? 'node' : 'edge') : <>{t.chaos.target} <strong>{selection.label}</strong></>}</span>
        </div>
      )}

      {scenario.magnitude && (
        <label className="field">
          <span>{scenario.magnitude.label}: <strong>{magnitude}{scenario.magnitude.unit}</strong></span>
          <input type="range" min={scenario.magnitude.min} max={scenario.magnitude.max} step={scenario.magnitude.step} value={magnitude} onChange={(event) => setMagnitudes((current) => ({ ...current, [scenario.id]: Number(event.target.value) }))} />
        </label>
      )}

      <div className="chaos-actions">
        <Button variant="chaos" block disabled={missingTarget || running} onClick={() => onRun({ scenarioId, targetId, magnitude, seed: Math.floor(Math.random() * 2 ** 31) })}>
          <Bomb size={15} />{running ? t.chaos.injecting : t.chaos.inject}
        </Button>
        {result && <button className="icon-btn" title={t.chaos.clear} aria-label={t.chaos.clearLabel} onClick={onClear}><Eraser size={15} /></button>}
      </div>
      {error && <p className="form-error">{error}</p>}

      {result && <ChaosReport result={result} />}

      {runs.length > 0 && (
        <div className="run-history">
          <span className="panel-label">{t.chaos.experiments(runs.length)}</span>
          <ul>
            {runs.slice(0, 12).map((run) => (
              <li key={run.id}>
                <button onClick={() => onShowRun(run)}>
                  <span className={`outcome-dot outcome-${run.result.outcome}`} />
                  <span><strong>{scenarios.find((item) => item.id === run.result.scenarioId)?.name}</strong><small>{run.result.targetLabel ?? (run.result.magnitude ? `${run.result.magnitude}×` : '')} · {relativeTime(run.createdAt)}</small></span>
                  <span className="mono-dim">{Math.round(run.result.servedRatio * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChaosReport({ result }: { result: ChaosResult }) {
  const { t, locale } = useI18n();
  const Icon = outcomeIcons[result.outcome];
  const hot = result.nodes.filter((node) => node.capacity > 0).sort((a, b) => b.load / b.capacity - a.load / a.capacity).slice(0, 4);
  return (
    <div className={`chaos-report outcome-${result.outcome}`}>
      <div className="chaos-outcome"><Icon size={18} /><strong>{t.chaos.outcome[result.outcome]}</strong>{result.targetLabel && <span className="mono-dim">· {result.targetLabel}</span>}</div>
      <div className="chaos-metrics">
        <div><span>{t.chaos.served}</span><strong>{(Math.round(result.servedRatio * 1000) / 10).toLocaleString(locale)}%</strong></div>
        <div><span>{t.chaos.latency}</span><strong className={result.latencyMs > result.latencyBudgetMs ? 'tone-fail' : ''}>{result.latencyMs} ms</strong><small>/ {result.latencyBudgetMs} ms</small></div>
        <div><span>{t.chaos.spofs}</span><strong className={result.singlePointsOfFailure.length ? 'tone-fail' : 'tone-pass'}>{result.singlePointsOfFailure.length}</strong></div>
      </div>
      {hot.length > 0 && (
        <div className="utilization">
          {hot.map((node) => {
            const ratio = node.load / node.capacity;
            return (
              <div key={node.id} className="dimension">
                <span title={node.label}>{node.label}</span>
                <div className="bar"><i className={ratio > 1 ? 'tone-bg-fail' : ratio > 0.7 ? 'tone-bg-borderline' : 'tone-bg-pass'} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
                <strong title={`${formatRate(node.load)} / ${formatRate(node.capacity)} req/s`}>{Math.round(ratio * 100)}%</strong>
              </div>
            );
          })}
        </div>
      )}
      <ul className="findings">{result.findings.map((finding) => <li key={finding}>{finding}</li>)}</ul>
    </div>
  );
}
