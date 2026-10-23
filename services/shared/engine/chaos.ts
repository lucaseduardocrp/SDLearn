import { componentSpecs } from '../catalog/components';
import { effectiveSpec, type EffectiveSpec } from '../catalog/technologies';
import type {
  CanvasEdge, CanvasNode, ChaosRequest, ChaosResult, ChaosScenario, ComponentKind, NodeHealth, NodeReport,
} from '../types/entities';
import { engineMessages } from '../i18n/engine';
import { defaultLocale, type Locale } from '../i18n/locale';

type ScenarioShape = Pick<ChaosScenario, 'id' | 'target'> & { magnitude?: Omit<NonNullable<ChaosScenario['magnitude']>, 'label'> };

const scenarioShapes: ScenarioShape[] = [
  { id: 'node-failure', target: 'node' },
  { id: 'replica-loss', target: 'node', magnitude: { min: 1, max: 10, step: 1, default: 1, unit: '' } },
  { id: 'network-partition', target: 'edge' },
  { id: 'traffic-spike', target: 'none', magnitude: { min: 1, max: 20, step: 1, default: 3, unit: '×' } },
  { id: 'latency-injection', target: 'node', magnitude: { min: 10, max: 2000, step: 10, default: 250, unit: 'ms' } },
  { id: 'chaos-monkey', target: 'none' },
];

export function chaosScenarios(locale: Locale = defaultLocale): ChaosScenario[] {
  const text = engineMessages(locale).scenarios;
  return scenarioShapes.map(({ magnitude, ...shape }) => ({
    ...shape, name: text[shape.id].name, description: text[shape.id].description,
    ...(magnitude ? { magnitude: { ...magnitude, label: text[shape.id].magnitude ?? '' } } : {}),
  }));
}

export class ChaosInputError extends Error {}

export interface ChaosGraph { nodes: CanvasNode[]; edges: CanvasEdge[] }
export interface ChaosLoadProfile { peakRps: number; latencyBudgetMs: number }

const STORAGE_KINDS = new Set<ComponentKind>(['sql', 'nosql', 'object-storage', 'search', 'vector-db', 'data-warehouse']);
const healthRank: Record<NodeHealth, number> = { healthy: 0, degraded: 1, unreachable: 2, failing: 3, down: 4 };

interface DependencyGroup { kind: ComponentKind; edges: CanvasEdge[]; soft: boolean; async: boolean }

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(value));
}

export function simulateChaos(graph: ChaosGraph, profile: ChaosLoadProfile, request: ChaosRequest, options: { skipSpofAnalysis?: boolean; locale?: Locale } = {}): ChaosResult {
  const text = engineMessages(options.locale).chaos;
  const components = graph.nodes.filter((node) => node.type === 'component' && node.data.kind && componentSpecs[node.data.kind]);
  const byId = new Map(components.map((node) => [node.id, node]));
  const edges = graph.edges.filter((edge) => byId.has(edge.source) && byId.has(edge.target) && edge.source !== edge.target);
  const kindOf = (id: string): ComponentKind => byId.get(id)!.data.kind!;
  // Technology and options (hit ratio, circuit breaker…) change the generic kind's capacity model.
  const specs = new Map(components.map((node) => [node.id, effectiveSpec(node.data)]));
  const specOf = (id: string): EffectiveSpec => specs.get(id)!;
  const labelOf = (id: string): string => byId.get(id)!.data.label || specOf(id).label;
  const replicasOf = (id: string): number => Math.max(1, byId.get(id)!.data.replicas ?? 1);

  const lostReplicas = new Map<string, number>();
  const cutEdges = new Set<string>();
  const extraLatency = new Map<string, number>();
  let multiplier = 1;
  let targetId: string | null = request.targetId ?? null;
  let magnitude: number | null = request.magnitude ?? null;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const requireNode = (): string => {
    if (!targetId || !byId.has(targetId)) throw new ChaosInputError(text.selectNode);
    return targetId;
  };

  switch (request.scenarioId) {
    case 'node-failure': lostReplicas.set(requireNode(), Infinity); magnitude = null; break;
    case 'replica-loss': magnitude = Math.round(clamp(magnitude ?? 1, 1, 100)); lostReplicas.set(requireNode(), magnitude); break;
    case 'latency-injection': magnitude = clamp(magnitude ?? 250, 0, 60_000); extraLatency.set(requireNode(), magnitude); break;
    case 'network-partition':
      if (!targetId || !edges.some((edge) => edge.id === targetId)) throw new ChaosInputError(text.selectEdge);
      cutEdges.add(targetId); magnitude = null; break;
    case 'traffic-spike': magnitude = clamp(magnitude ?? 3, 1, 1000); multiplier = magnitude; targetId = null; break;
    case 'chaos-monkey': {
      const candidates = components.filter((node) => !specOf(node.id).entry);
      const pick = candidates[Math.floor(seededRandom(request.seed ?? Date.now())() * candidates.length)];
      targetId = pick?.id ?? null; magnitude = pick ? 1 : null;
      if (pick) lostReplicas.set(pick.id, 1);
      break;
    }
  }

  const targetLabel = targetId ? (byId.has(targetId) ? labelOf(targetId) : edgeLabel(targetId)) : null;
  function edgeLabel(id: string): string | null {
    const edge = edges.find((item) => item.id === id);
    return edge ? `${labelOf(edge.source)} → ${labelOf(edge.target)}` : null;
  }

  if (components.length === 0) {
    return {
      scenarioId: request.scenarioId, targetId, targetLabel, magnitude, outcome: 'outage', servedRatio: 0, latencyMs: 0,
      latencyBudgetMs: profile.latencyBudgetMs, nodes: [], cutEdges: [], singlePointsOfFailure: [],
      findings: [text.emptyCanvas],
    };
  }

  const aliveReplicas = (id: string) => Math.max(0, replicasOf(id) - (lostReplicas.get(id) ?? 0));
  const isDown = (id: string) => aliveReplicas(id) === 0;
  const capacityOf = (id: string) => (isDown(id) ? 0 : specOf(id).capacityPerReplica * aliveReplicas(id));
  const liveEdge = (edge: CanvasEdge) => !cutEdges.has(edge.id);

  const outgoing = new Map<string, CanvasEdge[]>(components.map((node) => [node.id, []]));
  const incomingCount = new Map<string, number>(components.map((node) => [node.id, 0]));
  for (const edge of edges) {
    outgoing.get(edge.source)!.push(edge);
    incomingCount.set(edge.target, incomingCount.get(edge.target)! + 1);
  }

  const groupCache = new Map<string, DependencyGroup[]>();
  function groupsOf(id: string): DependencyGroup[] {
    const cached = groupCache.get(id);
    if (cached) return cached;
    const groups = new Map<string, DependencyGroup>();
    for (const edge of outgoing.get(id)!) {
      const kind = kindOf(edge.target);
      const async = Boolean(edge.async) || specOf(id).buffers;
      const targetSoft = specOf(edge.target).soft;
      const key = `${kind}:${async}:${targetSoft}`;
      // Entry points have no fallback, so every dependency of a client is hard.
      const group = groups.get(key) ?? { kind, edges: [], soft: (targetSoft && !specOf(id).entry) || async, async };
      group.edges.push(edge);
      groups.set(key, group);
    }
    const result = [...groups.values()];
    groupCache.set(id, result);
    return result;
  }
  /** Hit ratio of the best live cache a component reads through, or 0 without one. */
  const cacheHitOf = (id: string) => Math.max(0, ...groupsOf(id).filter((group) => group.kind === 'cache')
    .flatMap((group) => group.edges.filter((edge) => liveEdge(edge) && !isDown(edge.target)).map((edge) => specOf(edge.target).hitRatio)));

  let entries = components.filter((node) => specOf(node.id).entry);
  if (entries.length === 0) entries = components.filter((node) => incomingCount.get(node.id) === 0);
  if (entries.length === 0) entries = [components[0]];

  const reached = new Set<string>();
  const frontier = entries.map((node) => node.id);
  while (frontier.length) {
    const id = frontier.shift()!;
    if (reached.has(id)) continue;
    reached.add(id);
    if (isDown(id)) continue;
    for (const edge of outgoing.get(id)!) if (liveEdge(edge)) frontier.push(edge.target);
  }

  // Dependency health: a hard dependency group fails only when every member is unavailable.
  const reasons = new Map<string, string[]>(components.map((node) => [node.id, []]));
  const dependencyHealth = new Map<string, NodeHealth>();
  const visiting = new Set<string>();
  function evaluate(id: string): NodeHealth {
    const memo = dependencyHealth.get(id);
    if (memo) return memo;
    if (isDown(id)) {
      dependencyHealth.set(id, 'down');
      reasons.get(id)!.push(text.allReplicasDown);
      return 'down';
    }
    if (visiting.has(id)) return 'healthy';
    visiting.add(id);
    let health: NodeHealth = 'healthy';
    for (const group of groupsOf(id)) {
      const available = group.edges.filter((edge) => liveEdge(edge) && ['healthy', 'degraded'].includes(evaluate(edge.target)));
      if (available.length > 0) continue;
      const names = group.edges.map((edge) => labelOf(edge.target)).join(', ');
      if (group.soft) {
        health = worst(health, 'degraded');
        reasons.get(id)!.push(group.async ? text.consumerDown(names) : text.softDependencyDown(names));
      } else {
        health = worst(health, 'failing');
        reasons.get(id)!.push(text.hardDependencyDown(names));
      }
    }
    visiting.delete(id);
    dependencyHealth.set(id, health);
    return health;
  }
  components.forEach((node) => evaluate(node.id));

  // Load propagation in topological order (cycles are processed afterwards in canvas order).
  const load = new Map<string, number>(components.map((node) => [node.id, 0]));
  const backlog = new Map<string, number>();
  const totalTraffic = profile.peakRps * multiplier;
  for (const entry of entries) load.set(entry.id, load.get(entry.id)! + totalTraffic / entries.length);
  const indegree = new Map<string, number>(components.map((node) => [node.id, 0]));
  for (const edge of edges) if (liveEdge(edge)) indegree.set(edge.target, indegree.get(edge.target)! + 1);
  const order: string[] = [];
  const ready = components.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const edge of outgoing.get(id)!) {
      if (!liveEdge(edge)) continue;
      indegree.set(edge.target, indegree.get(edge.target)! - 1);
      if (indegree.get(edge.target) === 0) ready.push(edge.target);
    }
  }
  for (const node of components) if (!order.includes(node.id)) order.push(node.id);

  for (const id of order) {
    const incoming = load.get(id)!;
    if (isDown(id) || incoming <= 0) continue;
    const spec = specOf(id);
    let forwarded = incoming;
    if (spec.kind === 'cache' || spec.kind === 'cdn') forwarded *= 1 - spec.hitRatio;
    if (spec.buffers) {
      const consumerCapacity = outgoing.get(id)!.filter((edge) => liveEdge(edge) && !isDown(edge.target)).reduce((sum, edge) => sum + capacityOf(edge.target), 0);
      forwarded = Math.min(incoming, consumerCapacity);
      if (incoming - forwarded > 0) backlog.set(id, incoming - forwarded);
    }
    const cacheHit = cacheHitOf(id);
    for (const group of groupsOf(id)) {
      const alive = group.edges.filter((edge) => liveEdge(edge) && !isDown(edge.target));
      if (alive.length === 0) continue;
      const groupLoad = STORAGE_KINDS.has(group.kind) ? forwarded * (1 - cacheHit) : forwarded;
      for (const edge of alive) load.set(edge.target, load.get(edge.target)! + groupLoad / alive.length);
    }
  }

  const finalHealth = new Map<string, NodeHealth>();
  for (const node of components) {
    const id = node.id;
    let health = dependencyHealth.get(id)!;
    const lost = lostReplicas.get(id) ?? 0;
    if (!isDown(id) && lost > 0) {
      health = worst(health, 'degraded');
      reasons.get(id)!.push(text.replicasLost(lost, replicasOf(id)));
    }
    const capacity = capacityOf(id);
    const nodeLoad = load.get(id)!;
    if (!isDown(id) && nodeLoad > capacity) {
      health = worst(health, 'degraded');
      reasons.get(id)!.push(text.overload(formatRate(nodeLoad), formatRate(capacity), Math.round((nodeLoad / capacity) * 100)));
    }
    const queued = backlog.get(id);
    if (queued) reasons.get(id)!.push(text.backlog(formatRate(queued)));
    if ((extraLatency.get(id) ?? 0) > 0) {
      health = worst(health, 'degraded');
      reasons.get(id)!.push(text.extraLatency(extraLatency.get(id)!));
    }
    if (!reached.has(id) && !isDown(id)) {
      health = 'unreachable';
      reasons.get(id)!.push(text.unreachable);
    }
    finalHealth.set(id, health);
  }

  const servedMemo = new Map<string, number>();
  const servedVisiting = new Set<string>();
  function served(id: string): number {
    const memo = servedMemo.get(id);
    if (memo !== undefined) return memo;
    if (servedVisiting.has(id)) return 1;
    const health = finalHealth.get(id)!;
    if (health === 'down' || health === 'failing') return 0;
    servedVisiting.add(id);
    const nodeLoad = load.get(id)!;
    let ratio = nodeLoad > 0 ? Math.min(1, capacityOf(id) / nodeLoad) : 1;
    if (specOf(id).entry && groupsOf(id).every((group) => group.async)) ratio = 0;
    if (!specOf(id).buffers) {
      for (const group of groupsOf(id)) {
        if (group.soft) continue;
        const alive = group.edges.filter((edge) => liveEdge(edge) && !isDown(edge.target));
        ratio *= alive.length ? alive.reduce((sum, edge) => sum + served(edge.target), 0) / alive.length : 0;
      }
    }
    servedVisiting.delete(id);
    servedMemo.set(id, ratio);
    return ratio;
  }
  const servedRatio = entries.reduce((sum, entry) => sum + served(entry.id), 0) / entries.length;

  const latencyMemo = new Map<string, number>();
  const latencyVisiting = new Set<string>();
  function latency(id: string): number {
    const memo = latencyMemo.get(id);
    if (memo !== undefined) return memo;
    if (latencyVisiting.has(id)) return 0;
    latencyVisiting.add(id);
    const spec = specOf(id);
    const capacity = capacityOf(id);
    const utilization = capacity > 0 ? load.get(id)! / capacity : 1;
    let total = (spec.latencyMs + (extraLatency.get(id) ?? 0)) * (utilization > 1 ? Math.min(utilization, 10) : 1);
    if (!spec.buffers) {
      const cacheHit = cacheHitOf(id);
      const passThrough = spec.kind === 'cache' || spec.kind === 'cdn' ? 1 - spec.hitRatio : 1;
      for (const group of groupsOf(id)) {
        if (group.async) continue;
        const alive = group.edges.filter((edge) => liveEdge(edge) && !isDown(edge.target));
        if (!alive.length) continue;
        const best = Math.min(...alive.map((edge) => latency(edge.target)));
        total += best * passThrough * (STORAGE_KINDS.has(group.kind) ? 1 - cacheHit : 1);
      }
    }
    latencyVisiting.delete(id);
    latencyMemo.set(id, total);
    return total;
  }
  const latencyMs = Math.round(Math.max(...entries.map((entry) => latency(entry.id))));

  const nodes: NodeReport[] = components.map((node) => ({
    id: node.id, label: labelOf(node.id), health: finalHealth.get(node.id)!, load: Math.round(load.get(node.id)!),
    capacity: Number.isFinite(capacityOf(node.id)) ? capacityOf(node.id) : -1, reasons: reasons.get(node.id)!,
  }));

  const outcome: ChaosResult['outcome'] = servedRatio >= 0.99 && latencyMs <= profile.latencyBudgetMs ? 'survived' : servedRatio < 0.5 ? 'outage' : 'degraded';
  const findings: string[] = [];
  findings.push(text.served(Math.round(servedRatio * 1000) / 10, formatRate(totalTraffic)));
  if (latencyMs > profile.latencyBudgetMs) findings.push(text.latencyOverBudget(latencyMs, profile.latencyBudgetMs));
  else findings.push(text.latencyWithinBudget(latencyMs, profile.latencyBudgetMs));
  for (const report of nodes) {
    if (report.health !== 'healthy' && report.reasons.length) findings.push(`${report.label}: ${report.reasons.join(' ')}`);
  }
  if (targetId && byId.has(targetId) && outcome === 'survived' && (lostReplicas.has(targetId))) {
    findings.push(text.redundancyAbsorbed(labelOf(targetId)));
  }
  if (entries.every((entry) => groupsOf(entry.id).length === 0)) findings.push(text.entriesDisconnected);
  if (!entries.some((entry) => specOf(entry.id).entry)) findings.push(text.noClient);

  let singlePointsOfFailure: ChaosResult['singlePointsOfFailure'] = [];
  if (!options.skipSpofAnalysis) {
    singlePointsOfFailure = findSinglePointsOfFailure(graph, profile);
    if (singlePointsOfFailure.length) findings.push(text.singlePointsOfFailure(singlePointsOfFailure.map((item) => item.label).join(', ')));
  }

  return {
    scenarioId: request.scenarioId, targetId, targetLabel, magnitude, outcome, servedRatio: Math.round(servedRatio * 1000) / 1000,
    latencyMs, latencyBudgetMs: profile.latencyBudgetMs, nodes, cutEdges: [...cutEdges], singlePointsOfFailure, findings,
  };
}

/** A component is a single point of failure when losing one of its instances drops service below 50%. */
export function findSinglePointsOfFailure(graph: ChaosGraph, profile: ChaosLoadProfile): { id: string; label: string }[] {
  const baseline = simulateChaos(graph, profile, { scenarioId: 'traffic-spike', magnitude: 1 }, { skipSpofAnalysis: true });
  if (baseline.servedRatio < 0.5) return [];
  return graph.nodes
    .filter((node) => node.type === 'component' && node.data.kind && !componentSpecs[node.data.kind].entry)
    .filter((node) => simulateChaos(graph, profile, { scenarioId: 'replica-loss', targetId: node.id, magnitude: 1 }, { skipSpofAnalysis: true }).servedRatio < 0.5)
    .map((node) => ({ id: node.id, label: node.data.label || componentSpecs[node.data.kind!].label }));
}

function worst(a: NodeHealth, b: NodeHealth): NodeHealth {
  return healthRank[a] >= healthRank[b] ? a : b;
}
