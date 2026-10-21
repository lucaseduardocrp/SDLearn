import type {
  ArchitectureResponse,
  ChaosRunListResponse,
  ChaosRunResponse,
  ChaosScenarioListResponse,
  CreateSessionRequest,
  EvaluationListResponse,
  EvaluationResponse,
  HealthResponse,
  ProblemListResponse,
  ProblemQuery,
  ProblemResponse,
  RequestEvaluationRequest,
  SaveArchitectureRequest,
  SessionListResponse,
  SessionResponse,
  StartChaosRunRequest,
  UpdateSessionRequest,
} from '../types';

export interface ApiClient {
  getHealth(): Promise<HealthResponse>;
  listProblems(query?: ProblemQuery): Promise<ProblemListResponse>;
  getProblem(problemId: string): Promise<ProblemResponse>;
  createSession(input: CreateSessionRequest): Promise<SessionResponse>;
  listSessions(cursor?: string, limit?: number): Promise<SessionListResponse>;
  getSession(sessionId: string): Promise<SessionResponse>;
  updateSession(sessionId: string, input: UpdateSessionRequest): Promise<SessionResponse>;
  saveArchitecture(sessionId: string, input: SaveArchitectureRequest): Promise<ArchitectureResponse>;
  getArchitecture(sessionId: string): Promise<ArchitectureResponse>;
  listChaosScenarios(category?: string): Promise<ChaosScenarioListResponse>;
  startChaosRun(sessionId: string, input: StartChaosRunRequest): Promise<ChaosRunResponse>;
  getChaosRun(runId: string): Promise<ChaosRunResponse>;
  listRecentChaosRuns(): Promise<ChaosRunListResponse>;
  requestEvaluation(sessionId: string, input: RequestEvaluationRequest): Promise<EvaluationResponse>;
  listEvaluations(sessionId?: string, cursor?: string): Promise<EvaluationListResponse>;
  getEvaluation(evaluationId: string): Promise<EvaluationResponse>;
}