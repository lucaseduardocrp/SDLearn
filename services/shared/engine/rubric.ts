import { componentSpecs } from '../catalog/components';
import type { ChaosResult, ComponentKind, Design, Problem, RubricCheck, RubricReport } from '../types/entities';
import { engineMessages } from '../i18n/engine';
import type { Locale } from '../i18n/locale';
import { simulateChaos } from './chaos';

const equivalents: ComponentKind[][] = [['queue', 'stream'], ['sql', 'nosql'], ['load-balancer', 'api-gateway'], ['rate-limiter', 'api-gateway'], ['worker', 'stream-processor'], ['scheduler', 'workflow']];

function satisfied(kind: ComponentKind, present: Set<ComponentKind>): boolean {
  return present.has(kind) || equivalents.some((group) => group.includes(kind) && group.some((other) => present.has(other)));
}

export interface DesignAnalysis { rubric: RubricReport; baseline: ChaosResult }

export function analyzeDesign(design: Design, problem: Pick<Problem, 'expectedKinds' | 'peakRps' | 'latencyBudgetMs'>, locale?: Locale): DesignAnalysis {
  const messages = engineMessages(locale);
  const text = messages.rubric;
  const components = design.nodes.filter((node) => node.type === 'component' && node.data.kind);
  const present = new Set(components.map((node) => node.data.kind!));
  const baseline = simulateChaos(design, problem, { scenarioId: 'traffic-spike', magnitude: 1 });
  const checks: RubricCheck[] = [];

  const missing = problem.expectedKinds.filter((kind) => !satisfied(kind, present));
  const coverage = problem.expectedKinds.length ? 1 - missing.length / problem.expectedKinds.length : 1;
  checks.push({
    id: 'coverage', label: text.coverage, weight: 35, passed: missing.length === 0,
    detail: missing.length ? text.coverageMissing(missing.map((kind) => componentSpecs[kind].label).join(', ')) : text.coverageComplete,
  });

  const connected = new Set(design.edges.flatMap((edge) => [edge.source, edge.target]));
  const isolated = components.filter((node) => !connected.has(node.id));
  checks.push({
    id: 'connected', label: text.connected, weight: 10, passed: components.length > 1 && isolated.length === 0,
    detail: components.length <= 1 ? text.connectedTooFew : isolated.length ? text.connectedIsolated(isolated.map((node) => node.data.label).join(', ')) : text.connectedAll,
  });

  const storageReached = baseline.nodes.some((node) => {
    const kind = components.find((item) => item.id === node.id)?.data.kind;
    return kind && ['sql', 'nosql', 'object-storage', 'cache', 'search', 'stream', 'data-warehouse', 'vector-db'].includes(kind) && node.health !== 'unreachable';
  });
  checks.push({ id: 'data-path', label: text.dataPath, weight: 10, passed: storageReached, detail: storageReached ? text.dataPathReached : text.dataPathMissing });

  const spofs = baseline.singlePointsOfFailure;
  checks.push({
    id: 'spof', label: text.spof, weight: 15, passed: components.length > 1 && spofs.length === 0,
    detail: spofs.length ? text.spofFound(spofs.map((item) => item.label).join(', ')) : components.length > 1 ? text.spofNone : text.spofTooFew,
  });

  const handlesPeak = baseline.servedRatio >= 0.99;
  checks.push({ id: 'capacity', label: text.capacity(messages.number(problem.peakRps)), weight: 15, passed: handlesPeak, detail: text.capacityDetail(Math.round(baseline.servedRatio * 1000) / 10) });

  const withinBudget = storageReached && baseline.latencyMs <= problem.latencyBudgetMs;
  checks.push({ id: 'latency', label: text.latency(problem.latencyBudgetMs), weight: 10, passed: withinBudget, detail: text.latencyDetail(baseline.latencyMs) });

  const notesLength = design.notes.trim().length + design.nodes.filter((node) => node.type === 'note').reduce((sum, node) => sum + node.data.label.length, 0);
  checks.push({ id: 'tradeoffs', label: text.tradeoffs, weight: 5, passed: notesLength >= 200, detail: notesLength >= 200 ? text.tradeoffsPresent : text.tradeoffsMissing });

  const score = Math.round(checks.reduce((sum, check) => {
    if (check.id === 'coverage') return sum + check.weight * coverage;
    if (check.id === 'spof') return sum + (components.length > 1 ? check.weight * Math.max(0, 1 - spofs.length / Math.max(1, components.length - 1)) : 0);
    if (check.id === 'capacity') return sum + check.weight * Math.min(1, baseline.servedRatio);
    return sum + (check.passed ? check.weight : 0);
  }, 0));

  return { rubric: { score, checks }, baseline };
}

export function verdictFor(score: number): 'pass' | 'borderline' | 'fail' {
  return score >= 75 ? 'pass' : score >= 55 ? 'borderline' : 'fail';
}
