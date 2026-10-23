import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import {
  chaosRequestSchema, createSessionSchema, evaluationListQuerySchema, idParamSchema, problemQuerySchema,
  saveDesignSchema, sessionListQuerySchema,
} from '../../shared/schemas/validation';
import type {
  ChaosRequestInput, CreateSessionRequest, EvaluationListQuery, ProblemQuery, SaveDesignRequest, SessionListQuery,
} from '../../shared/schemas/validation';
import { ZodValidationPipe } from './common/zod-validation.pipe';
import { WorkbenchService } from './workbench.service';

@Controller()
export class WorkbenchController {
  constructor(private readonly service: WorkbenchService) {}

  @Get('problems')
  listProblems(@Query(new ZodValidationPipe(problemQuerySchema)) query: ProblemQuery) {
    return this.service.listProblems(query);
  }

  @Get('problems/:problemId')
  async getProblem(@Param('problemId', new ZodValidationPipe(idParamSchema)) problemId: string) {
    return { problem: await this.service.getProblem(problemId) };
  }

  @Get('articles')
  listArticles() {
    return this.service.listArticles();
  }

  @Get('articles/:slug')
  async getArticle(@Param('slug', new ZodValidationPipe(idParamSchema)) slug: string) {
    return { article: await this.service.getArticle(slug) };
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(@Body(new ZodValidationPipe(createSessionSchema)) input: CreateSessionRequest) {
    return { session: await this.service.createSession(input.problemId) };
  }

  @Get('sessions')
  listSessions(@Query(new ZodValidationPipe(sessionListQuerySchema)) query: SessionListQuery) {
    return this.service.listSessions(query);
  }

  @Get('sessions/:sessionId')
  async getSession(@Param('sessionId', new ZodValidationPipe(idParamSchema)) sessionId: string) {
    return { session: await this.service.getSession(sessionId) };
  }

  @Put('sessions/:sessionId/design')
  async saveDesign(
    @Param('sessionId', new ZodValidationPipe(idParamSchema)) sessionId: string,
    @Body(new ZodValidationPipe(saveDesignSchema)) input: SaveDesignRequest,
  ) {
    return { session: await this.service.saveDesign(sessionId, input.design) };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(@Param('sessionId', new ZodValidationPipe(idParamSchema)) sessionId: string) {
    await this.service.deleteSession(sessionId);
  }

  @Get('chaos/scenarios')
  listScenarios() {
    return { items: this.service.listScenarios() };
  }

  @Post('sessions/:sessionId/chaos-runs')
  @HttpCode(HttpStatus.CREATED)
  async runChaos(
    @Param('sessionId', new ZodValidationPipe(idParamSchema)) sessionId: string,
    @Body(new ZodValidationPipe(chaosRequestSchema)) input: ChaosRequestInput,
  ) {
    return { run: await this.service.runChaos(sessionId, input) };
  }

  @Get('sessions/:sessionId/chaos-runs')
  async listChaosRuns(@Param('sessionId', new ZodValidationPipe(idParamSchema)) sessionId: string) {
    return { items: await this.service.listChaosRuns(sessionId), nextCursor: null };
  }

  @Post('sessions/:sessionId/evaluations')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestEvaluation(@Param('sessionId', new ZodValidationPipe(idParamSchema)) sessionId: string) {
    return { evaluation: await this.service.requestEvaluation(sessionId) };
  }

  @Get('evaluations')
  listEvaluations(@Query(new ZodValidationPipe(evaluationListQuerySchema)) query: EvaluationListQuery) {
    return this.service.listEvaluations(query);
  }

  @Get('evaluations/:evaluationId')
  async getEvaluation(@Param('evaluationId', new ZodValidationPipe(idParamSchema)) evaluationId: string) {
    return { evaluation: await this.service.getEvaluation(evaluationId) };
  }
}
