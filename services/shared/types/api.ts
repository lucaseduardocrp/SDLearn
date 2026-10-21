import type { ArchitectureModel, ChaosRun, ChaosScenario, Evaluation, PracticeSession, Problem, Requirement } from './entities';

export interface CollectionResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ProblemResponse { problem: Problem | null }
export interface SessionResponse { session: PracticeSession | null; requirements: Requirement[] }
export interface ArchitectureResponse { architecture: ArchitectureModel | null }
export interface ChaosScenarioResponse { items: ChaosScenario[] }
export interface ChaosRunResponse { run: ChaosRun | null }
export interface EvaluationResponse { evaluation: Evaluation | null }
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unknown';
  services: Record<string, 'ok' | 'unavailable' | 'unknown'>;
}