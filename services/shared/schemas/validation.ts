import { z } from 'zod';

const componentKinds = [
  'client', 'dns', 'cdn', 'load-balancer', 'api-gateway', 'service', 'worker', 'websocket', 'cache', 'sql',
  'nosql', 'object-storage', 'queue', 'stream', 'search', 'rate-limiter', 'scheduler', 'external',
  'auth', 'workflow', 'stream-processor', 'data-warehouse', 'vector-db', 'observability',
] as const;
const chaosScenarioIds = ['node-failure', 'replica-loss', 'network-partition', 'traffic-spike', 'latency-injection', 'chaos-monkey'] as const;

export const idParamSchema = z.string().trim().min(1).max(128);
export const problemQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  tag: z.string().trim().max(60).optional(),
});
export const createSessionSchema = z.object({ problemId: idParamSchema });
export const sessionListQuerySchema = z.object({
  problemId: idParamSchema.optional(),
  cursor: z.string().trim().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const canvasNodeSchema = z.object({
  id: idParamSchema,
  type: z.enum(['component', 'note']),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  data: z.object({
    kind: z.enum(componentKinds).optional(),
    label: z.string().max(2000),
    replicas: z.number().int().min(1).max(100).optional(),
    notes: z.string().max(2000).optional(),
    tech: z.string().trim().max(60).optional(),
    config: z.record(z.string().max(60), z.union([z.string().max(200), z.number().finite(), z.boolean()])).refine((value) => Object.keys(value).length <= 40, 'too many options').optional(),
  }),
});
export const canvasEdgeSchema = z.object({
  id: idParamSchema,
  source: idParamSchema,
  target: idParamSchema,
  label: z.string().max(80).optional(),
  async: z.boolean().optional(),
  protocol: z.string().trim().max(40).optional(),
});
export const designSchema = z.object({
  nodes: z.array(canvasNodeSchema).max(200),
  edges: z.array(canvasEdgeSchema).max(400),
  mermaid: z.string().max(30000),
  notes: z.string().max(20000),
});
export const saveDesignSchema = z.object({ design: designSchema });

export const chaosRequestSchema = z.object({
  scenarioId: z.enum(chaosScenarioIds),
  targetId: idParamSchema.optional(),
  magnitude: z.number().finite().min(0).max(100000).optional(),
  seed: z.number().int().optional(),
});
export const evaluationListQuerySchema = z.object({
  sessionId: idParamSchema.optional(),
  cursor: z.string().trim().max(256).optional(),
});

export type ProblemQuery = z.infer<typeof problemQuerySchema>;
export type CreateSessionRequest = z.infer<typeof createSessionSchema>;
export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;
export type SaveDesignRequest = z.infer<typeof saveDesignSchema>;
export type ChaosRequestInput = z.infer<typeof chaosRequestSchema>;
export type EvaluationListQuery = z.infer<typeof evaluationListQuerySchema>;

const providerIds = ['openai', 'anthropic', 'gemini', 'xai', 'ollama', 'azure-openai'] as const;
const providerUpdateSchema = z.object({
  apiKey: z.string().trim().max(500).nullable().optional(),
  baseUrl: z.union([z.string().trim().url().max(300), z.literal('')]).nullable().optional(),
  deployment: z.string().trim().max(120).nullable().optional(),
}).strict();
const judgeAssignmentSchema = z.object({ provider: z.enum(providerIds).nullable(), model: z.string().trim().max(200).nullable() }).strict();
export const settingsUpdateSchema = z.object({
  providers: z.object(Object.fromEntries(providerIds.map((id) => [id, providerUpdateSchema.optional()])) as Record<(typeof providerIds)[number], z.ZodOptional<typeof providerUpdateSchema>>).strict().optional(),
  judges: z.object({ rigor: judgeAssignmentSchema.optional(), pragmatic: judgeAssignmentSchema.optional(), moderator: judgeAssignmentSchema.optional() }).strict().optional(),
  samples: z.union([z.literal(1), z.literal(3)]).optional(),
  hubUrl: z.string().trim().max(500).optional(),
}).strict();
export const providerIdSchema = z.enum(providerIds);
export const packIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60);

export type SettingsUpdateRequest = z.infer<typeof settingsUpdateSchema>;
