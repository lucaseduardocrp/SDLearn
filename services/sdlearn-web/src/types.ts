export type Verdict = 'Pass' | 'Borderline' | 'Fail';
export type SessionStatus = 'In progress' | 'Completed';

export interface Problem {
  id: string;
  name: string;
  domain: string;
  difficulty: 'Intermediate' | 'Advanced';
  estimatedMinutes: number;
  summary: string;
}

export interface ProblemQuery {
  q?: string;
  domain?: string;
  difficulty?: string;
  cursor?: string;
}

export interface ProblemListResponse {
  items: Problem[];
  nextCursor: string | null;
}

export interface ProblemResponse {
  problem: Problem | null;
}

export interface Requirement {
  id: string;
  system: string;
  requirement: string;
  constraint: string;
  state: 'In progress' | 'Open';
  category: string;
  decision: string;
}

export interface PracticeSession {
  id: string;
  problemId: string;
  system: string;
  focus: string;
  score: number | null;
  verdict: Verdict | null;
  status: SessionStatus;
  updatedAt: string;
  notes: string;
  decisions: string[];
}

export interface SessionListResponse {
  items: PracticeSession[];
  nextCursor: string | null;
}

export interface SessionResponse {
  session: PracticeSession | null;
  requirements: Requirement[];
}

export interface CreateSessionRequest {
  problemId: string;
}

export interface UpdateSessionRequest {
  notes?: string;
  decisions?: string[];
  status?: SessionStatus;
}

export interface ArchitectureComponent {
  id: string;
  name: string;
  responsibility: string;
  technology: string;
  status: 'Ready' | 'Proposed';
}

export interface ArchitectureModel {
  components: ArchitectureComponent[];
  mermaid: string;
}

export interface ArchitectureResponse {
  architecture: ArchitectureModel | null;
}

export interface SaveArchitectureRequest {
  diagram: ArchitectureComponent[];
  mermaid: string;
}

export interface ChaosScenario {
  id: string;
  name: string;
  fault: string;
  duration: string;
  category: string;
}

export interface ChaosScenarioListResponse {
  items: ChaosScenario[];
}

export interface StartChaosRunRequest {
  scenarioId: string;
  parameters: { durationSeconds: number };
}

export interface ChaosRun {
  id: string;
  sessionId: string;
  scenario: string;
  status: 'Ready' | 'Running' | 'Completed';
  outcome: string;
  startedAt: string;
}

export interface ChaosRunResponse {
  run: ChaosRun | null;
}

export interface ChaosRunListResponse {
  items: ChaosRun[];
}

export interface JudgeResult {
  judge: 'Scalability Judge' | 'Reliability Judge';
  score: number;
  verdict: Verdict;
  feedback: string;
}

export interface Evaluation {
  id: string;
  sessionId: string;
  system: string;
  focus: string;
  score: number;
  verdict: Verdict;
  feedback: string;
  judges: JudgeResult[];
}

export interface EvaluationListResponse {
  items: Evaluation[];
  nextCursor: string | null;
}

export interface EvaluationResponse {
  evaluation: Evaluation | null;
}

export interface RequestEvaluationRequest {
  submission: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unknown';
  services: Record<string, 'ok' | 'unavailable' | 'unknown'>;
}