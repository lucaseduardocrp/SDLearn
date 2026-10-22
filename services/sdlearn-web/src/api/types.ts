import type {
  Article, ArticleSummary, ChaosRequest, ChaosRun, ChaosScenario, CollectionResponse, Design, Evaluation,
  HealthResponse, PracticeSession, Problem, ProblemSummary, SessionSummary,
} from '../types';

export interface ApiClient {
  readonly mode: 'http' | 'local';
  getHealth(): Promise<HealthResponse>;
  listProblems(): Promise<CollectionResponse<ProblemSummary>>;
  getProblem(problemId: string): Promise<Problem>;
  listArticles(): Promise<CollectionResponse<ArticleSummary>>;
  getArticle(slug: string): Promise<Article>;
  createSession(problemId: string): Promise<PracticeSession>;
  listSessions(problemId?: string): Promise<CollectionResponse<SessionSummary>>;
  getSession(sessionId: string): Promise<PracticeSession>;
  saveDesign(sessionId: string, design: Design): Promise<PracticeSession>;
  deleteSession(sessionId: string): Promise<void>;
  listChaosScenarios(): Promise<ChaosScenario[]>;
  runChaos(sessionId: string, request: ChaosRequest): Promise<ChaosRun>;
  listChaosRuns(sessionId: string): Promise<ChaosRun[]>;
  requestEvaluation(sessionId: string): Promise<Evaluation>;
  listEvaluations(sessionId?: string): Promise<CollectionResponse<Evaluation>>;
  getEvaluation(evaluationId: string): Promise<Evaluation>;
}
