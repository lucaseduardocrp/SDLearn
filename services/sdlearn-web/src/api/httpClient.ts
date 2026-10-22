import type {
  ArticleResponse, ArticleSummary, ChaosRun, ChaosRunResponse, ChaosScenarioResponse, CollectionResponse, Evaluation,
  EvaluationResponse, HealthResponse, ProblemResponse, ProblemSummary, SessionResponse, SessionSummary,
} from '../types';
import type { ApiClient } from './types';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new ApiError('Não foi possível falar com a API. Ela está rodando? (npm run dev:api)', 0);
  }
  if (!response.ok) {
    let message = `A requisição falhou com status ${response.status}.`;
    try {
      const body = await response.json() as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // Keep the HTTP status message when the server response is not JSON.
    }
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const id = encodeURIComponent;

export const httpClient: ApiClient = {
  mode: 'http',
  getHealth: () => request<HealthResponse>('/health').catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 503) return { status: 'degraded', services: { database: 'unavailable' }, judgeProvider: null } satisfies HealthResponse;
    throw error;
  }),
  listProblems: () => request<CollectionResponse<ProblemSummary>>('/problems'),
  getProblem: async (problemId) => (await request<ProblemResponse>(`/problems/${id(problemId)}`)).problem,
  listArticles: () => request<CollectionResponse<ArticleSummary>>('/articles'),
  getArticle: async (slug) => (await request<ArticleResponse>(`/articles/${id(slug)}`)).article,
  createSession: async (problemId) => (await request<SessionResponse>('/sessions', { method: 'POST', body: JSON.stringify({ problemId }) })).session,
  listSessions: (problemId) => request<CollectionResponse<SessionSummary>>(`/sessions${problemId ? `?problemId=${id(problemId)}` : ''}`),
  getSession: async (sessionId) => (await request<SessionResponse>(`/sessions/${id(sessionId)}`)).session,
  saveDesign: async (sessionId, design) => (await request<SessionResponse>(`/sessions/${id(sessionId)}/design`, { method: 'PUT', body: JSON.stringify({ design }) })).session,
  deleteSession: (sessionId) => request<void>(`/sessions/${id(sessionId)}`, { method: 'DELETE' }),
  listChaosScenarios: async () => (await request<ChaosScenarioResponse>('/chaos/scenarios')).items,
  runChaos: async (sessionId, input) => (await request<ChaosRunResponse>(`/sessions/${id(sessionId)}/chaos-runs`, { method: 'POST', body: JSON.stringify(input) })).run,
  listChaosRuns: async (sessionId) => (await request<CollectionResponse<ChaosRun>>(`/sessions/${id(sessionId)}/chaos-runs`)).items,
  requestEvaluation: async (sessionId) => (await request<EvaluationResponse>(`/sessions/${id(sessionId)}/evaluations`, { method: 'POST', body: '{}' })).evaluation,
  listEvaluations: (sessionId) => request<CollectionResponse<Evaluation>>(`/evaluations${sessionId ? `?sessionId=${id(sessionId)}` : ''}`),
  getEvaluation: async (evaluationId) => (await request<EvaluationResponse>(`/evaluations/${id(evaluationId)}`)).evaluation,
};
