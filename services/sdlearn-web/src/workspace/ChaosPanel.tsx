import { useState } from 'react';
import { Bomb, Crosshair, Dices, Eraser, Flame, Scissors, ShieldCheck, Snail, Skull, TrendingUp, TriangleAlert } from 'lucide-react';
import { chaosScenarios, formatRate } from '@shared/engine/chaos';
import type { ChaosRequest, ChaosResult, ChaosRun, ChaosScenarioId } from '../types';
import { relativeTime } from '../lib/format';

const scenarioIcons: Record<ChaosScenarioId, typeof Bomb> = {
  'node-failure': Skull, 'replica-loss': Flame, 'network-partition': Scissors, 'traffic-spike': TrendingUp, 'latency-injection': Snail, 'chaos-monkey': Dices,
};
const outcomeCopy: Record<ChaosResult['outcome'], { title: string; icon: typeof Bomb }> = {
  survived: { title: 'Sobreviveu', icon: ShieldCheck },
  degraded: { title: 'Degradou', icon: TriangleAlert },
  outage: { title: 'Caiu', icon: Bomb },
};

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
  const [scenarioId, setScenarioId] = useState<ChaosScenarioId>('node-failure');
  const scenario = chaosScenarios.find((item) => item.id === scenarioId)!;
  const [magnitudes, setMagnitudes] = useState<Record<string, number>>({});
  const magnitude = scenario.magnitude ? magnitudes[scenario.id] ?? scenario.magnitude.default : undefined;
  const targetId = scenario.target === 'node' ? selection.nodeId : scenario.target === 'edge' ? selection.edgeId : undefined;
  const missingTarget = scenario.target !== 'none' && !targetId;

  return (
    <div className="chaos-panel">
      <div className="scenario-list" role="radiogroup" aria-label="Cenário de falha">
        {chaosScenarios.map((item) => {
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
          <span>{missingTarget ? `Clique em ${scenario.target === 'node' ? 'um componente' : 'uma conexão'} no canvas para escolher o alvo.` : <>Alvo: <strong>{selection.label}</strong></>}</span>
        </div>
      )}

      {scenario.magnitude && (
        <label className="field">
          <span>{scenario.magnitude.label}: <strong>{magnitude}{scenario.magnitude.unit}</strong></span>
          <input type="range" min={scenario.magnitude.min} max={scenario.magnitude.max} step={scenario.magnitude.step} value={magnitude} onChange={(event) => setMagnitudes((current) => ({ ...current, [scenario.id]: Number(event.target.value) }))} />
        </label>
      )}

      <div className="chaos-actions">
        <button className="btn btn-chaos btn-block" disabled={missingTarget || running} onClick={() => onRun({ scenarioId, targetId, magnitude, seed: Math.floor(Math.random() * 2 ** 31) })}>
          <Bomb size={15} />{running ? 'Injetando…' : 'Injetar falha'}
        </button>
        {result && <button className="icon-btn" title="Limpar resultado do canvas" aria-label="Limpar resultado" onClick={onClear}><Eraser size={15} /></button>}
      </div>
      {error && <p className="form-error">{error}</p>}

      {result && <ChaosReport result={result} />}

      {runs.length > 0 && (
        <div className="run-history">
          <span className="panel-label">Experimentos ({runs.length})</span>
          <ul>
            {runs.slice(0, 12).map((run) => (
              <li key={run.id}>
                <button onClick={() => onShowRun(run)}>
                  <span className={`outcome-dot outcome-${run.result.outcome}`} />
                  <span><strong>{chaosScenarios.find((item) => item.id === run.result.scenarioId)?.name}</strong><small>{run.result.targetLabel ?? (run.result.magnitude ? `${run.result.magnitude}×` : '')} · {relativeTime(run.createdAt)}</small></span>
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
  const copy = outcomeCopy[result.outcome];
  const Icon = copy.icon;
  const hot = result.nodes.filter((node) => node.capacity > 0).sort((a, b) => b.load / b.capacity - a.load / a.capacity).slice(0, 4);
  return (
    <div className={`chaos-report outcome-${result.outcome}`}>
      <div className="chaos-outcome"><Icon size={18} /><strong>{copy.title}</strong>{result.targetLabel && <span className="mono-dim">· {result.targetLabel}</span>}</div>
      <div className="chaos-metrics">
        <div><span>Atendidas</span><strong>{Math.round(result.servedRatio * 1000) / 10}%</strong></div>
        <div><span>Latência</span><strong className={result.latencyMs > result.latencyBudgetMs ? 'tone-fail' : ''}>{result.latencyMs} ms</strong><small>/ {result.latencyBudgetMs} ms</small></div>
        <div><span>SPOFs</span><strong className={result.singlePointsOfFailure.length ? 'tone-fail' : 'tone-pass'}>{result.singlePointsOfFailure.length}</strong></div>
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
