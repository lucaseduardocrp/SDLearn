import type {
  Article, ArticleSummary, ChaosRequest, ChaosRun, ChaosScenario, CollectionResponse, Design, Evaluation,
  HealthResponse, HubPackEntry, InstalledPack, PackBundle, PracticeSession, ProblemDetail, ProblemSummary, ProviderId,
  PublicSettings, SessionSummary, SettingsUpdate,
} from '../types';

export type HubPackStatus = 'available' | 'installed' | 'update';
export interface HubListing {
  source: string;
  name: string | null;
  error: string | null;
  packs: (HubPackEntry & { status: HubPackStatus; installedVersion: string | null })[];
  installed: InstalledPack[];
}
export interface ProviderTestResult { ok: boolean; latencyMs: number; error?: string }

export interface ApiClient {
  readonly mode: 'http' | 'local';
  getHealth(): Promise<HealthResponse>;
  listProblems(): Promise<CollectionResponse<ProblemSummary>>;
  getProblem(problemId: string): Promise<ProblemDetail>;
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
  getSettings(): Promise<PublicSettings>;
  updateSettings(update: SettingsUpdate): Promise<PublicSettings>;
  listProviderModels(provider: ProviderId): Promise<string[]>;
  testProvider(provider: ProviderId, model: string): Promise<ProviderTestResult>;
  getHub(): Promise<HubListing>;
  installPack(packId: string): Promise<InstalledPack>;
  importPack(bundle: PackBundle | unknown): Promise<InstalledPack>;
  removePack(packId: string, force?: boolean): Promise<void>;
}
