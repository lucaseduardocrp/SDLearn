import { articles, findArticle } from '@shared/catalog/articles';
import { findProblem, problems } from '@shared/catalog/problems';
import { chaosScenarios, simulateChaos } from '@shared/engine/chaos';
import { analyzeDesign } from '@shared/engine/rubric';
import type { ChaosRun, Evaluation, PracticeSession } from '../types';
import type { ApiClient } from './types';

const STORAGE_KEY = 'archon.offline.v1';

interface LocalState { sessions: PracticeSession[]; chaosRuns: ChaosRun[]; evaluations: Evaluation[] }

function load(): LocalState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LocalState;
  } catch {
    // Storage can be unavailable (private mode); fall back to an in-memory state.
  }
  return { sessions: [], chaosRuns: [], evaluations: [] };
}

let state = load();

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota or privacy errors; the session keeps working in memory.
  }
}

function requireSession(id: string): PracticeSession {
  const session = state.sessions.find((item) => item.id === id);
  if (!session) throw new Error('Sessão não encontrada.');
  return session;
}

function requireProblem(id: string) {
  const problem = findProblem(id);
  if (!problem) throw new Error('Problema não encontrado.');
  return problem;
}

function upsertSession(session: PracticeSession): PracticeSession {
  state = { ...state, sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)] };
  persist();
  return session;
}

const delay = <T>(value: T): Promise<T> => new Promise((resolve) => window.setTimeout(() => resolve(structuredClone(value)), 60));

export const localClient: ApiClient = {
  mode: 'local',
  getHealth: () => delay({ status: 'ok', services: { api: 'ok', database: 'ok', 'ai-judges': 'unavailable' }, judgeProvider: null }),
  listProblems: () => delay({ items: problems.map(({ id, number, title, difficulty, summary, tags, estimatedMinutes }) => ({ id, number, title, difficulty, summary, tags, estimatedMinutes })), nextCursor: null }),
  getProblem: async (id) => delay(requireProblem(id)),
  listArticles: () => delay({ items: articles.map(({ body: _body, ...summary }) => summary), nextCursor: null }),
  getArticle: async (slug) => {
    const article = findArticle(slug);
    if (!article) throw new Error('Artigo não encontrado.');
    return delay(article);
  },
  createSession: async (problemId) => {
    const problem = requireProblem(problemId);
    const now = new Date().toISOString();
    return delay(upsertSession({
      id: crypto.randomUUID(), problemId, title: problem.title, difficulty: problem.difficulty, status: 'in-progress', createdAt: now, updatedAt: now,
      design: { nodes: [{ id: 'client', type: 'component', position: { x: 0, y: 160 }, data: { kind: 'client', label: 'Client', replicas: 1 } }], edges: [], mermaid: '', notes: '' },
      bestScore: null, lastVerdict: null,
    }));
  },
  listSessions: async (problemId) => delay({
    items: state.sessions.filter((item) => !problemId || item.problemId === problemId).map(({ design, ...rest }) => ({ ...rest, componentCount: design.nodes.filter((node) => node.type === 'component').length })),
    nextCursor: null,
  }),
  getSession: async (id) => delay(requireSession(id)),
  saveDesign: async (id, design) => delay(upsertSession({ ...requireSession(id), design, updatedAt: new Date().toISOString() })),
  deleteSession: async (id) => {
    state = { sessions: state.sessions.filter((item) => item.id !== id), chaosRuns: state.chaosRuns.filter((item) => item.sessionId !== id), evaluations: state.evaluations.filter((item) => item.sessionId !== id) };
    persist();
    return delay(undefined);
  },
  listChaosScenarios: () => delay(chaosScenarios),
  runChaos: async (sessionId, request) => {
    const session = requireSession(sessionId);
    const run: ChaosRun = { id: crypto.randomUUID(), sessionId, createdAt: new Date().toISOString(), result: simulateChaos(session.design, requireProblem(session.problemId), request) };
    state = { ...state, chaosRuns: [run, ...state.chaosRuns] };
    persist();
    return delay(run);
  },
  listChaosRuns: async (sessionId) => delay(state.chaosRuns.filter((item) => item.sessionId === sessionId)),
  requestEvaluation: async (sessionId) => {
    const session = requireSession(sessionId);
    const problem = requireProblem(session.problemId);
    const now = new Date().toISOString();
    const evaluation: Evaluation = {
      id: crypto.randomUUID(), sessionId, problemId: problem.id, problemTitle: problem.title, createdAt: now, updatedAt: now,
      status: 'heuristic', provider: null, rubric: analyzeDesign(session.design, problem).rubric, assessments: [], debate: [], consensus: null,
      error: 'Modo offline: os juízes de IA rodam na API. Esta é apenas a pré-avaliação automática do seu desenho.',
    };
    state = { ...state, evaluations: [evaluation, ...state.evaluations] };
    upsertSession({ ...session, status: session.status === 'judged' ? 'judged' : 'submitted', updatedAt: now });
    return delay(evaluation);
  },
  listEvaluations: async (sessionId) => delay({ items: state.evaluations.filter((item) => !sessionId || item.sessionId === sessionId), nextCursor: null }),
  getEvaluation: async (id) => {
    const evaluation = state.evaluations.find((item) => item.id === id);
    if (!evaluation) throw new Error('Avaliação não encontrada.');
    return delay(evaluation);
  },
};
