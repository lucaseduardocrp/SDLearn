export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Verdict = 'pass' | 'borderline' | 'fail';
export type SessionStatus = 'in-progress' | 'submitted' | 'judged';

export interface Problem {
  id: string;
  number: number;
  title: string;
  difficulty: Difficulty;
  summary: string;
  tags: string[];
  estimatedMinutes: number;
  statement: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  scale: { label: string; value: string }[];
  /** Peak request rate used by the chaos engine's capacity model. */
  peakRps: number;
  /** End-to-end latency budget for the synchronous read path, in milliseconds. */
  latencyBudgetMs: number;
  /** Component kinds a reasonable design is expected to include (checked by the rubric). */
  expectedKinds: ComponentKind[];
  hints: string[];
  relatedArticles: string[];
}

export type ComponentKind =
  | 'client' | 'dns' | 'cdn' | 'load-balancer' | 'api-gateway' | 'service' | 'worker'
  | 'websocket' | 'cache' | 'sql' | 'nosql' | 'object-storage' | 'queue' | 'stream'
  | 'search' | 'rate-limiter' | 'scheduler' | 'external';

export interface CanvasNode {
  id: string;
  type: 'component' | 'note';
  position: { x: number; y: number };
  data: {
    kind?: ComponentKind;
    label: string;
    replicas?: number;
    notes?: string;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  async?: boolean;
}

export interface Design {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  mermaid: string;
  notes: string;
}

export interface PracticeSession {
  id: string;
  problemId: string;
  title: string;
  difficulty: Difficulty;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  design: Design;
  bestScore: number | null;
  lastVerdict: Verdict | null;
}

export type ChaosScenarioId = 'node-failure' | 'replica-loss' | 'network-partition' | 'traffic-spike' | 'latency-injection' | 'chaos-monkey';

export interface ChaosScenario {
  id: ChaosScenarioId;
  name: string;
  description: string;
  target: 'node' | 'edge' | 'none';
  magnitude?: { label: string; min: number; max: number; step: number; default: number; unit: string };
}

export interface ChaosRequest {
  scenarioId: ChaosScenarioId;
  targetId?: string;
  magnitude?: number;
  seed?: number;
}

export type NodeHealth = 'healthy' | 'degraded' | 'failing' | 'down' | 'unreachable';

export interface NodeReport {
  id: string;
  label: string;
  health: NodeHealth;
  load: number;
  capacity: number;
  reasons: string[];
}

export interface ChaosResult {
  scenarioId: ChaosScenarioId;
  targetId: string | null;
  targetLabel: string | null;
  magnitude: number | null;
  outcome: 'survived' | 'degraded' | 'outage';
  servedRatio: number;
  latencyMs: number;
  latencyBudgetMs: number;
  nodes: NodeReport[];
  cutEdges: string[];
  singlePointsOfFailure: { id: string; label: string }[];
  findings: string[];
}

export interface ChaosRun {
  id: string;
  sessionId: string;
  createdAt: string;
  result: ChaosResult;
}

export interface RubricCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  weight: number;
}

export interface RubricReport {
  score: number;
  checks: RubricCheck[];
}

export type JudgeId = 'rigor' | 'pragmatic';

export interface JudgeAssessment {
  judge: JudgeId;
  score: number;
  verdict: Verdict;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  dimensions: { name: string; score: number }[];
}

export interface DebateTurn {
  judge: JudgeId;
  revisedScore: number;
  agreements: string[];
  disagreements: string[];
  argument: string;
}

export interface Consensus {
  score: number;
  verdict: Verdict;
  summary: string;
  keyStrengths: string[];
  keyImprovements: string[];
  nextSteps: string[];
}

export type EvaluationStatus = 'queued' | 'judging' | 'debating' | 'deliberating' | 'completed' | 'heuristic' | 'failed';

export interface Evaluation {
  id: string;
  sessionId: string;
  problemId: string;
  problemTitle: string;
  createdAt: string;
  updatedAt: string;
  status: EvaluationStatus;
  provider: string | null;
  error: string | null;
  rubric: RubricReport;
  assessments: JudgeAssessment[];
  debate: DebateTurn[];
  consensus: Consensus | null;
}

export interface Article {
  slug: string;
  title: string;
  category: string;
  summary: string;
  readingMinutes: number;
  body: string;
  relatedProblems: string[];
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details: Record<string, unknown> | null;
  };
}
