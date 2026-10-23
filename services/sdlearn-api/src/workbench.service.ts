import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ChaosInputError, chaosScenarios, simulateChaos } from '../../shared/engine/chaos';
import { analyzeDesign } from '../../shared/engine/rubric';
import type { ArticleSummary, ProblemSummary, SessionSummary } from '../../shared/types/api';
import type { ChaosRequest, ChaosRun, Design, Evaluation, JudgeRole, PracticeSession, Problem } from '../../shared/types/entities';
import type { EvaluationListQuery, ProblemQuery, SessionListQuery } from '../../shared/schemas/validation';
import { ContentService } from './content/content.service';
import { AppError } from './errors/app-error';
import { JudgePanel } from './judges/judge-panel';
import { RecordStore } from './persistence/record-store';
import { SettingsService, type JudgeSetup } from './settings/settings.service';

const RUNNING_STATUSES: Evaluation['status'][] = ['queued', 'judging', 'debating', 'deliberating'];
const STALE_EVALUATION_MS = 10 * 60 * 1000;

export function starterDesign(): Design {
  return {
    nodes: [{ id: 'client', type: 'component', position: { x: 0, y: 160 }, data: { kind: 'client', label: 'Client', replicas: 1 } }],
    edges: [],
    mermaid: '',
    notes: '',
  };
}

@Injectable()
export class WorkbenchService {
  private readonly logger = new Logger(WorkbenchService.name);
  private readonly pending = new Map<string, Promise<void>>();

  constructor(
    private readonly store: RecordStore,
    private readonly content: ContentService,
    private readonly judges: SettingsService,
  ) {}

  async judgeSummary(): Promise<string | null> {
    const setup = await this.judges.judgeSetup();
    if (!setup) return null;
    return [...new Set(Object.values(setup.runners).map((runner) => runner.label))].join(' + ');
  }

  async listProblems(query: ProblemQuery): Promise<{ items: ProblemSummary[]; nextCursor: null }> {
    const text = query.q?.toLowerCase();
    const items = (await this.content.catalog()).problems
      .filter((item) => (!text || `${item.title} ${item.summary} ${item.tags.join(' ')}`.toLowerCase().includes(text))
        && (!query.difficulty || item.difficulty === query.difficulty)
        && (!query.tag || item.tags.some((tag) => tag.toLowerCase() === query.tag!.toLowerCase())))
      .map(({ id, number, title, difficulty, summary, tags, estimatedMinutes, source }) => ({ id, number, title, difficulty, summary, tags, estimatedMinutes, source }));
    return { items, nextCursor: null };
  }

  /** The grading key stays on the server until the problem has been judged. */
  async getProblem(id: string): Promise<Omit<Problem, 'keyPoints'> & { keyPointCount: number }> {
    const { keyPoints, ...problem } = await this.content.getProblem(id);
    return { ...problem, keyPointCount: keyPoints.length };
  }

  async listArticles(): Promise<{ items: ArticleSummary[]; nextCursor: null }> {
    return { items: (await this.content.catalog()).articles.map(({ body: _body, ...summary }) => summary), nextCursor: null };
  }

  getArticle(slug: string) { return this.content.getArticle(slug); }

  async createSession(problemId: string): Promise<PracticeSession> {
    const problem = await this.content.getProblem(problemId);
    const now = new Date().toISOString();
    const session: PracticeSession = {
      id: randomUUID(), problemId, title: problem.title, difficulty: problem.difficulty, status: 'in-progress',
      createdAt: now, updatedAt: now, design: starterDesign(), bestScore: null, lastVerdict: null,
    };
    return this.store.write('session', session.id, session);
  }

  async listSessions(query: SessionListQuery): Promise<{ items: SessionSummary[]; nextCursor: string | null }> {
    const all = (await this.store.list<PracticeSession>('session')).filter((item) => !query.problemId || item.problemId === query.problemId);
    const summaries = all.map(({ design, ...rest }) => ({ ...rest, componentCount: design.nodes.filter((node) => node.type === 'component').length }));
    return this.page(summaries, query.cursor, query.limit);
  }

  async getSession(id: string): Promise<PracticeSession> {
    const session = await this.store.read<PracticeSession>('session', id);
    if (!session) throw new AppError(404, 'NOT_FOUND', `Session with ID '${id}' was not found`);
    return session;
  }

  async saveDesign(id: string, design: Design): Promise<PracticeSession> {
    const session = await this.getSession(id);
    return this.store.write('session', id, { ...session, design, updatedAt: new Date().toISOString() });
  }

  async deleteSession(id: string): Promise<void> {
    await this.getSession(id);
    await this.store.removeSession(id);
  }

  listScenarios() { return chaosScenarios; }

  async runChaos(sessionId: string, request: ChaosRequest): Promise<ChaosRun> {
    const session = await this.getSession(sessionId);
    const problem = await this.content.getProblem(session.problemId);
    try {
      const run: ChaosRun = { id: randomUUID(), sessionId, createdAt: new Date().toISOString(), result: simulateChaos(session.design, problem, request) };
      return this.store.write('chaos-run', run.id, run);
    } catch (error) {
      if (error instanceof ChaosInputError) throw new AppError(422, 'VALIDATION_ERROR', error.message);
      throw error;
    }
  }

  async listChaosRuns(sessionId: string): Promise<ChaosRun[]> {
    await this.getSession(sessionId);
    return (await this.store.list<ChaosRun>('chaos-run')).filter((run) => run.sessionId === sessionId);
  }

  async requestEvaluation(sessionId: string): Promise<Evaluation> {
    const session = await this.getSession(sessionId);
    const problem = await this.content.getProblem(session.problemId);
    const { rubric } = analyzeDesign(session.design, problem);
    const setup = await this.judges.judgeSetup();
    const now = new Date().toISOString();
    const judgeConfig = setup ? Object.fromEntries(Object.entries(setup.runners).map(([role, runner]) => [role, runner.label])) as Record<JudgeRole, string> : null;
    const evaluation: Evaluation = {
      id: randomUUID(), sessionId, problemId: problem.id, problemTitle: problem.title, createdAt: now, updatedAt: now,
      status: setup ? 'queued' : 'heuristic', provider: judgeConfig ? [...new Set(Object.values(judgeConfig))].join(' + ') : null, judgeConfig,
      error: setup ? null : 'Nenhum juiz de IA configurado. Esta é apenas a pré-avaliação automática; configure um provedor em Configurações para receber a nota dos dois juízes.',
      rubric, assessments: [], debate: [], consensus: null,
    };
    await this.store.write('evaluation', evaluation.id, evaluation);
    await this.store.write('session', session.id, { ...session, status: session.status === 'judged' ? 'judged' : 'submitted', updatedAt: now });
    if (setup) this.pending.set(evaluation.id, this.processEvaluation(evaluation, session, problem, setup).finally(() => this.pending.delete(evaluation.id)));
    return evaluation;
  }

  /** Resolves when the background judging of an evaluation has finished (used by tests and graceful shutdown). */
  async whenSettled(evaluationId: string): Promise<void> { await this.pending.get(evaluationId); }

  async listEvaluations(query: EvaluationListQuery) {
    const all = (await this.store.list<Evaluation>('evaluation')).filter((item) => !query.sessionId || item.sessionId === query.sessionId);
    return this.page(all.map((item) => this.markStale(item)), query.cursor, 50);
  }

  async getEvaluation(id: string): Promise<Evaluation> {
    const evaluation = await this.store.read<Evaluation>('evaluation', id);
    if (!evaluation) throw new AppError(404, 'NOT_FOUND', `Evaluation with ID '${id}' was not found`);
    return this.markStale(evaluation);
  }

  private async processEvaluation(evaluation: Evaluation, session: PracticeSession, problem: Problem, setup: JudgeSetup): Promise<void> {
    let current = evaluation;
    const save = async (patch: Partial<Evaluation>) => {
      current = { ...current, ...patch, updatedAt: new Date().toISOString() };
      await this.store.write('evaluation', current.id, current);
    };
    try {
      const { baseline } = analyzeDesign(session.design, problem);
      const chaosRuns = (await this.store.list<ChaosRun>('chaos-run')).filter((run) => run.sessionId === session.id);
      const result = await new JudgePanel(setup.runners, setup.samples).run({ problem, design: session.design, rubric: evaluation.rubric, baseline, chaosRuns }, async (progress) => {
        await save({ status: progress.phase, assessments: progress.assessments ?? current.assessments, debate: progress.debate ?? current.debate });
      });
      await save({ status: 'completed', ...result });
      const latest = await this.getSession(session.id);
      await this.store.write('session', session.id, {
        ...latest, status: 'judged', lastVerdict: result.consensus.verdict, updatedAt: new Date().toISOString(),
        bestScore: Math.max(latest.bestScore ?? 0, result.consensus.score),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(JSON.stringify({ event: 'evaluation.failed', evaluationId: evaluation.id, error: message }));
      await save({ status: 'failed', error: `Os juízes não concluíram a avaliação: ${message}` }).catch(() => undefined);
    }
  }

  private markStale(evaluation: Evaluation): Evaluation {
    const stale = RUNNING_STATUSES.includes(evaluation.status) && !this.pending.has(evaluation.id)
      && Date.now() - Date.parse(evaluation.updatedAt) > STALE_EVALUATION_MS;
    return stale ? { ...evaluation, status: 'failed', error: 'A avaliação foi interrompida (o servidor reiniciou). Solicite novamente.' } : evaluation;
  }

  private page<T>(all: T[], cursor: string | undefined, limit: number) {
    let offset = 0;
    if (cursor) {
      offset = Number(cursor);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new AppError(422, 'VALIDATION_ERROR', 'Cursor is invalid.');
    }
    const items = all.slice(offset, offset + limit);
    return { items, nextCursor: offset + items.length < all.length ? String(offset + items.length) : null };
  }
}
