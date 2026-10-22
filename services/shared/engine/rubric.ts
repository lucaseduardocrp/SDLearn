import { componentSpecs } from '../catalog/components';
import type { ChaosResult, ComponentKind, Design, Problem, RubricCheck, RubricReport } from '../types/entities';
import { simulateChaos } from './chaos';

const equivalents: ComponentKind[][] = [['queue', 'stream'], ['sql', 'nosql'], ['load-balancer', 'api-gateway'], ['rate-limiter', 'api-gateway']];

function satisfied(kind: ComponentKind, present: Set<ComponentKind>): boolean {
  return present.has(kind) || equivalents.some((group) => group.includes(kind) && group.some((other) => present.has(other)));
}

export interface DesignAnalysis { rubric: RubricReport; baseline: ChaosResult }

export function analyzeDesign(design: Design, problem: Problem): DesignAnalysis {
  const components = design.nodes.filter((node) => node.type === 'component' && node.data.kind);
  const present = new Set(components.map((node) => node.data.kind!));
  const baseline = simulateChaos(design, problem, { scenarioId: 'traffic-spike', magnitude: 1 });
  const checks: RubricCheck[] = [];

  const missing = problem.expectedKinds.filter((kind) => !satisfied(kind, present));
  const coverage = problem.expectedKinds.length ? 1 - missing.length / problem.expectedKinds.length : 1;
  checks.push({
    id: 'coverage', label: 'Componentes essenciais', weight: 35, passed: missing.length === 0,
    detail: missing.length ? `Faltando: ${missing.map((kind) => componentSpecs[kind].label).join(', ')}.` : 'Todos os blocos esperados para este problema estão presentes.',
  });

  const connected = new Set(design.edges.flatMap((edge) => [edge.source, edge.target]));
  const isolated = components.filter((node) => !connected.has(node.id));
  checks.push({
    id: 'connected', label: 'Componentes conectados', weight: 10, passed: components.length > 1 && isolated.length === 0,
    detail: components.length <= 1 ? 'O design precisa de pelo menos dois componentes conectados.' : isolated.length ? `Sem conexões: ${isolated.map((node) => node.data.label).join(', ')}.` : 'Todo componente participa de algum fluxo.',
  });

  const storageReached = baseline.nodes.some((node) => {
    const kind = components.find((item) => item.id === node.id)?.data.kind;
    return kind && ['sql', 'nosql', 'object-storage', 'cache', 'search', 'stream'].includes(kind) && node.health !== 'unreachable';
  });
  checks.push({ id: 'data-path', label: 'Caminho até os dados', weight: 10, passed: storageReached, detail: storageReached ? 'As entradas alcançam ao menos um armazenamento.' : 'Nenhum armazenamento é alcançado a partir das entradas.' });

  const spofs = baseline.singlePointsOfFailure;
  checks.push({
    id: 'spof', label: 'Sem pontos únicos de falha', weight: 15, passed: components.length > 1 && spofs.length === 0,
    detail: spofs.length ? `Perder uma instância de ${spofs.map((item) => item.label).join(', ')} derruba o sistema.` : components.length > 1 ? 'Nenhuma falha de instância isolada derruba o serviço.' : 'Sem componentes suficientes para avaliar.',
  });

  const handlesPeak = baseline.servedRatio >= 0.99;
  checks.push({ id: 'capacity', label: `Aguenta o pico (${problem.peakRps.toLocaleString('en-US')} req/s)`, weight: 15, passed: handlesPeak, detail: `${Math.round(baseline.servedRatio * 1000) / 10}% das requisições atendidas no pico estimado.` });

  const withinBudget = storageReached && baseline.latencyMs <= problem.latencyBudgetMs;
  checks.push({ id: 'latency', label: `Latência ≤ ${problem.latencyBudgetMs} ms`, weight: 10, passed: withinBudget, detail: `Estimativa do caminho síncrono: ${baseline.latencyMs} ms.` });

  const notesLength = design.notes.trim().length + design.nodes.filter((node) => node.type === 'note').reduce((sum, node) => sum + node.data.label.length, 0);
  checks.push({ id: 'tradeoffs', label: 'Trade-offs documentados', weight: 5, passed: notesLength >= 200, detail: notesLength >= 200 ? 'Há notas explicando as decisões.' : 'Escreva ao menos um parágrafo com decisões e trade-offs.' });

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
