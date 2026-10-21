import type { ApiClient } from './types';
import { getPreviewDataState } from './previewState';
import { architecture as seededArchitecture, chaosRuns as seededChaosRuns, chaosScenarios, evaluations as seededEvaluations, problems, requirements, sessions as seededSessions } from '../mocks/data';
import type { ArchitectureModel, ChaosRun, Evaluation, PracticeSession } from '../types';

let sessions = [...seededSessions];
let chaosRuns = [...seededChaosRuns];
let evaluations = [...seededEvaluations];
let savedArchitecture: ArchitectureModel = structuredClone(seededArchitecture);
let nextId = 1;

async function respond<T>(value: T): Promise<T> {
  const state = getPreviewDataState();
  if (state === 'loading') await new Promise<void>(() => undefined);
  if (state === 'error') throw new Error('The preview API could not load this data. Retry the request.');
  await new Promise((resolve) => window.setTimeout(resolve, 140));
  return value;
}

function page<T>(items: T[], _cursor?: string): { items: T[]; nextCursor: string | null } {
  const isEmpty = getPreviewDataState() === 'empty';
  return { items: isEmpty ? [] : items, nextCursor: null };
}

export const mockClient: ApiClient = {
  getHealth: () => respond({ status: 'ok', services: { api: 'ok', database: 'ok', 'ai-judges': 'unavailable' } }),
  listProblems: async (query) => {
    const normalizedQuery = query?.q?.trim().toLowerCase();
    const items = problems.filter((problem) =>
      (!normalizedQuery || `${problem.name} ${problem.summary}`.toLowerCase().includes(normalizedQuery)) &&
      (!query?.domain || problem.domain === query.domain) &&
      (!query?.difficulty || problem.difficulty === query.difficulty),
    );
    return respond(page(items, query?.cursor));
  },
  getProblem: async (problemId) => respond({ problem: getPreviewDataState() === 'empty' ? null : problems.find((problem) => problem.id === problemId) ?? null }),
  createSession: async ({ problemId }) => {
    const problem = problems.find((item) => item.id === problemId);
    if (!problem) throw new Error('Problem not found.');
    const session: PracticeSession = { id: `session-${nextId++}`, problemId, system: problem.name, focus: 'Requirements and tradeoffs', score: null, verdict: null, status: 'In progress', updatedAt: new Date().toISOString(), notes: '', decisions: [] };
    sessions = [session, ...sessions];
    return respond({ session, requirements: getPreviewDataState() === 'empty' ? [] : requirements });
  },
  listSessions: async (cursor, _limit) => respond(page(sessions, cursor)),
  getSession: async (sessionId) => respond({ session: getPreviewDataState() === 'empty' ? null : sessions.find((session) => session.id === sessionId) ?? null, requirements: getPreviewDataState() === 'empty' ? [] : requirements }),
  updateSession: async (sessionId, input) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error('Session not found.');
    Object.assign(session, input, { updatedAt: new Date().toISOString() });
    return respond({ session, requirements: getPreviewDataState() === 'empty' ? [] : requirements });
  },
  saveArchitecture: async (_sessionId, input) => {
    savedArchitecture = { components: input.diagram, mermaid: input.mermaid };
    return respond({ architecture: savedArchitecture });
  },
  getArchitecture: async () => respond({ architecture: getPreviewDataState() === 'empty' ? null : savedArchitecture }),
  listChaosScenarios: async (category) => respond({ items: getPreviewDataState() === 'empty' ? [] : chaosScenarios.filter((item) => !category || item.category === category) }),
  startChaosRun: async (sessionId, input) => {
    const scenario = chaosScenarios.find((item) => item.id === input.scenarioId);
    if (!scenario) throw new Error('Chaos scenario not found.');
    const run: ChaosRun = { id: `run-${nextId++}`, sessionId, scenario: scenario.name, status: 'Running', outcome: 'Simulation is collecting service signals.', startedAt: new Date().toISOString() };
    chaosRuns = [run, ...chaosRuns];
    return respond({ run });
  },
  getChaosRun: async (runId) => respond({ run: getPreviewDataState() === 'empty' ? null : chaosRuns.find((run) => run.id === runId) ?? null }),
  listRecentChaosRuns: async () => respond({ items: getPreviewDataState() === 'empty' ? [] : chaosRuns }),
  requestEvaluation: async (sessionId, input) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error('Session not found.');
    const evaluation: Evaluation = { id: `eval-${nextId++}`, sessionId, system: session.system, focus: session.focus, score: 0, verdict: 'Borderline', feedback: `Demo evaluation unavailable: no AI provider is configured. Submission received (${input.submission.length} characters).`, judges: [
      { judge: 'Scalability Judge', score: 0, verdict: 'Borderline', feedback: 'Demo result: configure a provider to request an independent AI assessment.' },
      { judge: 'Reliability Judge', score: 0, verdict: 'Borderline', feedback: 'Demo result: configure a provider to request an independent AI assessment.' },
    ] };
    evaluations = [evaluation, ...evaluations];
    return respond({ evaluation });
  },
  listEvaluations: async (sessionId, cursor) => respond(page(evaluations.filter((item) => !sessionId || item.sessionId === sessionId), cursor)),
  getEvaluation: async (evaluationId) => respond({ evaluation: getPreviewDataState() === 'empty' ? null : evaluations.find((item) => item.id === evaluationId) ?? null }),
};