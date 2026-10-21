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

export interface ChaosScenario {
  id: string;
  name: string;
  fault: string;
  duration: string;
  category: string;
}

export interface ChaosRun {
  id: string;
  sessionId: string;
  scenario: string;
  status: 'Ready' | 'Running' | 'Completed';
  outcome: string;
  startedAt: string;
}

export interface JudgeResult {
  judge: 'Scalability Judge' | 'Reliability Judge';
  score: number | null;
  verdict: Verdict | null;
  feedback: string;
  status: 'completed' | 'unavailable';
}

export interface Evaluation {
  id: string;
  sessionId: string;
  system: string;
  focus: string;
  score: number | null;
  verdict: Verdict | null;
  feedback: string;
  status: 'completed' | 'unavailable';
  judges: JudgeResult[];
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