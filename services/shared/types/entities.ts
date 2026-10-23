export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Verdict = 'pass' | 'borderline' | 'fail';
export type SessionStatus = 'in-progress' | 'submitted' | 'judged';

export interface KeyPoint {
  id: string;
  /** What a strong answer must cover, phrased as a checkable statement. */
  point: string;
  /** Relative importance, 1 (nice to have) to 5 (essential). */
  weight: number;
}

/** Where a problem or article came from: null for built-in content, otherwise the installed hub pack. */
export interface ContentSource {
  packId: string;
  packName: string;
  version: string;
}

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
  /** Grading key used by the AI judges; never shown before submission. */
  keyPoints: KeyPoint[];
  source: ContentSource | null;
}

export type ComponentKind =
  | 'client' | 'dns' | 'cdn' | 'load-balancer' | 'api-gateway' | 'service' | 'worker'
  | 'websocket' | 'cache' | 'sql' | 'nosql' | 'object-storage' | 'queue' | 'stream'
  | 'search' | 'rate-limiter' | 'scheduler' | 'external'
  | 'auth' | 'workflow' | 'stream-processor' | 'data-warehouse' | 'vector-db' | 'observability';

/** Value of a component option (see catalog/technologies). */
export type ComponentOptionValue = string | number | boolean;

export interface CanvasNode {
  id: string;
  type: 'component' | 'note';
  position: { x: number; y: number };
  data: {
    kind?: ComponentKind;
    label: string;
    replicas?: number;
    notes?: string;
    /** Concrete technology (catalog/technologies), e.g. 'rabbitmq' for a queue. */
    tech?: string;
    /** Kind-specific options such as delivery guarantees or cache hit ratio. */
    config?: Record<string, ComponentOptionValue>;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  async?: boolean;
  /** Wire protocol (catalog/technologies `protocols`), e.g. 'grpc' or 'amqp'. */
  protocol?: string;
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
export type KeyPointCoverageLevel = 'full' | 'partial' | 'missing';

export interface KeyPointCoverage {
  id: string;
  point: string;
  weight: number;
  coverage: KeyPointCoverageLevel;
  evidence: string;
}

export interface JudgeAssessment {
  judge: JudgeId;
  /** Final judge score: 60% key-point coverage + 40% holistic, or holistic alone when the problem has no key points. */
  score: number;
  holisticScore?: number;
  coverageScore?: number | null;
  keyPoints?: KeyPointCoverage[];
  /** provider/model that produced this assessment. */
  model?: string;
  samples?: number;
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
  model?: string;
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
  /** provider/model used for each role when the evaluation ran. */
  judgeConfig?: Record<JudgeRole, string> | null;
  error: string | null;
  rubric: RubricReport;
  assessments: JudgeAssessment[];
  debate: DebateTurn[];
  consensus: Consensus | null;
}

export interface Article {
  slug: string;
  source: ContentSource | null;
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

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'ollama' | 'azure-openai';
export type JudgeRole = 'rigor' | 'pragmatic' | 'moderator';

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  configured: boolean;
  /** Last characters of the stored key, for recognition only. */
  keyHint: string | null;
  baseUrl: string | null;
  deployment: string | null;
  /** Whether the credentials come from the settings page or from environment variables. */
  source: 'settings' | 'env' | null;
  needsKey: boolean;
}

export interface JudgeAssignment { provider: ProviderId | null; model: string | null }

export interface PublicSettings {
  providers: ProviderStatus[];
  judges: Record<JudgeRole, JudgeAssignment>;
  samples: 1 | 3;
  hubUrl: string;
  secretsEncrypted: boolean;
}

export interface ProviderUpdate { apiKey?: string | null; baseUrl?: string | null; deployment?: string | null }

export interface SettingsUpdate {
  providers?: Partial<Record<ProviderId, ProviderUpdate>>;
  judges?: Partial<Record<JudgeRole, JudgeAssignment>>;
  samples?: 1 | 3;
  hubUrl?: string;
}

export interface PackManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  tags: string[];
}

export type PackProblem = Omit<Problem, 'number' | 'source'>;
export type PackArticle = Omit<Article, 'source'>;

export interface PackBundle {
  format: 'archon-pack@1';
  manifest: PackManifest;
  problems: PackProblem[];
  articles: PackArticle[];
}

export interface HubPackEntry extends PackManifest {
  problemCount: number;
  articleCount: number;
  /** Bundle location, absolute or relative to the index URL. */
  bundle: string;
  sha256: string;
  size: number;
}

export interface HubIndex {
  format: 'archon-hub@1';
  name: string;
  updatedAt: string;
  packs: HubPackEntry[];
}

export interface InstalledPack {
  manifest: PackManifest;
  installedAt: string;
  origin: 'hub' | 'import';
  sha256: string | null;
  problemCount: number;
  articleCount: number;
}
