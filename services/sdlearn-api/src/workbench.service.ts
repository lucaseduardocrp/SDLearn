import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { articles, findArticle } from '../../shared/catalog/articles';
import { findProblem, problems } from '../../shared/catalog/problems';
import { ChaosInputError, chaosScenarios, simulateChaos } from '../../shared/engine/chaos';
import { analyzeDesign } from '../../shared/engine/rubric';
import type { ArticleSummary, ProblemSummary, SessionSummary } from '../../shared/types/api';
import type { ChaosRequest, ChaosRun, Design, Evaluation, PracticeSession, Problem } from '../../shared/types/entities';
import type { EvaluationListQuery, ProblemQuery, SessionListQuery } from '../../shared/schemas/validation';
import { AppError, notFound } from './errors/app-error';
import { JudgePanel } from './judges/judge-panel';
import type { LlmProvider } from './judges/llm-provider';
import { PostgresService } from './persistence/postgres.service';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
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

  constructor(private readonly db: PostgresService, @Inject(LLM_PROVIDER) private readonly llm: LlmProvider | null) {}

  get judgeProviderName(): string | null { return this.llm?.name ?? null; }

  listProblems(query: ProblemQuery): { items: ProblemSummary[]; nextCursor: null } {
    const text = query.q?.toLowerCase();
    const items = problems
      .filter((item) => (!text || `${item.title} ${item.summary} ${item.tags.join(' ')}`.toLowerCase().includes(text))
        && (!query.difficulty || item.difficulty === query.difficulty)
        && (!query.tag || item.tags.some((tag) => tag.toLowerCase() === query.tag!.toLowerCase())))
      .map(({ id, number, title, difficulty, summary, tags, estimatedMinutes }) => ({ id, number, title, difficulty, summary, tags, estimatedMinutes }));
    return { items, nextCursor: null };
  }

  getProblem(id: string): Problem {
    const problem = findProblem(id);
    if (!problem) throw notFound('Problem', id);
    return problem;
  }

  listArticles(): { items: ArticleSummary[]; nextCursor: null } {
    return { items: articles.map(({ body: _body, ...summary }) => summary), nextCursor: null };
  }

  getArticle(slug: string) {
    const article = findArticle(slug);
    if (!article) throw notFound('Article', slug);
    return article;
  }

  async createSession(problemId: string): Promise<PracticeSession> {
    const problem = this.getProblem(problemId);
    const now = new Date().toISOString();
    const session: PracticeSession = {
      id: randomUUID(), problemId, title: problem.title, difficulty: problem.difficulty, status: 'in-progress',
      createdAt: now, updatedAt: now, design: starterDesign(), bestScore: null, lastVerdict: null,
    };
    return this.write('session', session.id, session);
  }

  async listSessions(query: SessionListQuery): Promise<{ items: SessionSummary[]; nextCursor: string | null }> {
    const all = (await this.list<PracticeSession>('session')).filter((item) => !query.problemId || item.problemId === query.problemId);
    const summaries = all.map(({ design, ...rest }) => ({ ...rest, componentCount: design.nodes.filter((node) => node.type === 'component').length }));
    return this.page(summaries, query.cursor, query.limit);
  }

  async getSession(id: string): Promise<PracticeSession> {
    const session = await this.read<PracticeSession>('session', id);
    if (!session) throw notFound('Session', id);
    return session;
  }

  async saveDesign(id: string, design: Design): Promise<PracticeSession> {
    const session = await this.getSession(id);
    return this.write('session', id, { ...session, design, updatedAt: new Date().toISOString() });
  }

  async deleteSession(id: string): Promise<void> {
    await this.getSession(id);
    await this.db.query("DELETE FROM sdlearn_records WHERE (kind = 'session' AND id = $1) OR (kind IN ('chaos-run', 'evaluation') AND payload->>'sessionId' = $1)", [id]);
  }

  listScenarios() { return chaosScenarios; }

  async runChaos(sessionId: string, request: ChaosRequest): Promise<ChaosRun> {
    const session = await this.getSession(sessionId);
    const problem = this.getProblem(session.problemId);
    try {
      const run: ChaosRun = { id: randomUUID(), sessionId, createdAt: new Date().toISOString(), result: simulateChaos(session.design, problem, request) };
      return this.write('chaos-run', run.id, run);
    } catch (error) {
      if (error instanceof ChaosInputError) throw new AppError(422, 'VALIDATION_ERROR', error.message);
      throw error;
    }
  }

  async listChaosRuns(sessionId: string): Promise<ChaosRun[]> {
    await this.getSession(sessionId);
    return (await this.list<ChaosRun>('chaos-run')).filter((run) => run.sessionId === sessionId);
  }

  async requestEvaluation(sessionId: string): Promise<Evaluation> {
    const session = await this.getSession(sessionId);
    const problem = this.getProblem(session.problemId);
    const { rubric } = analyzeDesign(session.design, problem);
    const now = new Date().toISOString();
    const evaluation: Evaluation = {
      id: randomUUID(), sessionId, problemId: problem.id, problemTitle: problem.title, createdAt: now, updatedAt: now,
      status: this.llm ? 'queued' : 'heuristic', provider: this.llm?.name ?? null,
      error: this.llm ? null : 'Nenhum provedor de IA configurado. Esta é apenas a pré-avaliação automática; configure um provedor para receber a nota dos dois juízes.',
      rubric, assessments: [], debate: [], consensus: null,
    };
    await this.write('evaluation', evaluation.id, evaluation);
    await this.write('session', session.id, { ...session, status: session.status === 'judged' ? 'judged' : 'submitted', updatedAt: now });
    if (this.llm) this.pending.set(evaluation.id, this.processEvaluation(evaluation, session, problem, this.llm).finally(() => this.pending.delete(evaluation.id)));
    return evaluation;
  }

  /** Resolves when the background judging of an evaluation has finished (used by tests and graceful shutdown). */
  async whenSettled(evaluationId: string): Promise<void> { await this.pending.get(evaluationId); }

  async listEvaluations(query: EvaluationListQuery) {
    const all = (await this.list<Evaluation>('evaluation')).filter((item) => !query.sessionId || item.sessionId === query.sessionId);
    return this.page(all.map((item) => this.markStale(item)), query.cursor, 50);
  }

  async getEvaluation(id: string): Promise<Evaluation> {
    const evaluation = await this.read<Evaluation>('evaluation', id);
    if (!evaluation) throw notFound('Evaluation', id);
    return this.markStale(evaluation);
  }

  private async processEvaluation(evaluation: Evaluation, session: PracticeSession, problem: Problem, llm: LlmProvider): Promise<void> {
    let current = evaluation;
    const save = async (patch: Partial<Evaluation>) => {
      current = { ...current, ...patch, updatedAt: new Date().toISOString() };
      await this.write('evaluation', current.id, current);
    };
    try {
      const { baseline } = analyzeDesign(session.design, problem);
      const chaosRuns = (await this.list<ChaosRun>('chaos-run')).filter((run) => run.sessionId === session.id);
      const result = await new JudgePanel(llm).run({ problem, design: session.design, rubric: evaluation.rubric, baseline, chaosRuns }, async (progress) => {
        await save({ status: progress.phase, assessments: progress.assessments ?? current.assessments, debate: progress.debate ?? current.debate });
      });
      await save({ status: 'completed', ...result });
      const latest = await this.getSession(session.id);
      await this.write('session', session.id, {
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

  private async read<T>(kind: string, id: string): Promise<T | null> {
    const result = await this.db.query<{ payload: T }>('SELECT payload FROM sdlearn_records WHERE kind = $1 AND id = $2', [kind, id]);
    return result.rows[0]?.payload ?? null;
  }

  private async list<T>(kind: string): Promise<T[]> {
    const result = await this.db.query<{ payload: T }>('SELECT payload FROM sdlearn_records WHERE kind = $1 ORDER BY updated_at DESC', [kind]);
    return result.rows.map((row) => row.payload);
  }

  private async write<T>(kind: string, id: string, payload: T): Promise<T> {
    await this.db.query('INSERT INTO sdlearn_records (kind, id, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT (kind, id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()', [kind, id, JSON.stringify(payload)]);
    return payload;
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
