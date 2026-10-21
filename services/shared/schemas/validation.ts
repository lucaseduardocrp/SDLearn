import { z } from 'zod';

export const idParamSchema = z.string().trim().min(1).max(128);
export const problemQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  domain: z.string().trim().max(80).optional(),
  difficulty: z.enum(['Intermediate', 'Advanced']).optional(),
  cursor: z.string().trim().max(256).optional(),
});
export const createSessionSchema = z.object({ problemId: idParamSchema });
export const sessionListQuerySchema = z.object({
  cursor: z.string().trim().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const updateSessionSchema = z.object({
  notes: z.string().max(20000).optional(),
  decisions: z.array(z.string().max(2000)).max(100).optional(),
  status: z.enum(['In progress', 'Completed']).optional(),
}).refine((input) => Object.keys(input).length > 0, 'At least one session field is required');
export const architectureComponentSchema = z.object({
  id: idParamSchema,
  name: z.string().trim().min(1).max(120),
  responsibility: z.string().trim().min(1).max(1000),
  technology: z.string().trim().min(1).max(120),
  status: z.enum(['Ready', 'Proposed']),
});
export const saveArchitectureSchema = z.object({
  diagram: z.array(architectureComponentSchema).max(100),
  mermaid: z.string().max(30000),
});
export const chaosScenarioQuerySchema = z.object({ category: z.string().trim().max(80).optional() });
export const startChaosRunSchema = z.object({
  scenarioId: idParamSchema,
  parameters: z.object({ durationSeconds: z.number().int().min(10).max(7200) }).strict(),
});
export const evaluationRequestSchema = z.object({ submission: z.string().trim().min(20).max(50000) });
export const evaluationListQuerySchema = z.object({
  sessionId: idParamSchema.optional(),
  cursor: z.string().trim().max(256).optional(),
});

export type ProblemQuery = z.infer<typeof problemQuerySchema>;
export type CreateSessionRequest = z.infer<typeof createSessionSchema>;
export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;
export type UpdateSessionRequest = z.infer<typeof updateSessionSchema>;
export type SaveArchitectureRequest = z.infer<typeof saveArchitectureSchema>;
export type StartChaosRunRequest = z.infer<typeof startChaosRunSchema>;
export type EvaluationRequest = z.infer<typeof evaluationRequestSchema>;
export type EvaluationListQuery = z.infer<typeof evaluationListQuerySchema>;