import type { Article, ChaosRun, ChaosScenario, Evaluation, PracticeSession, Problem } from './entities';

export interface CollectionResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export type ProblemSummary = Pick<Problem, 'id' | 'number' | 'title' | 'difficulty' | 'summary' | 'tags' | 'estimatedMinutes'>;
export type ArticleSummary = Omit<Article, 'body'>;
export type SessionSummary = Omit<PracticeSession, 'design'> & { componentCount: number };

export interface ProblemResponse { problem: Problem }
export interface SessionResponse { session: PracticeSession }
export interface ChaosScenarioResponse { items: ChaosScenario[] }
export interface ChaosRunResponse { run: ChaosRun }
export interface EvaluationResponse { evaluation: Evaluation }
export interface ArticleResponse { article: Article }
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unknown';
  services: Record<string, 'ok' | 'unavailable' | 'unknown'>;
  judgeProvider: string | null;
}
