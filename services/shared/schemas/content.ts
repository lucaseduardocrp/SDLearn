import { z } from 'zod';

const componentKinds = [
  'client', 'dns', 'cdn', 'load-balancer', 'api-gateway', 'service', 'worker', 'websocket', 'cache', 'sql',
  'nosql', 'object-storage', 'queue', 'stream', 'search', 'rate-limiter', 'scheduler', 'external',
] as const;

/** Lowercase slug: letters, digits and single dashes. Dots are reserved for pack namespacing. */
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use lowercase letters, digits and dashes').min(2).max(60);
const text = (max: number) => z.string().trim().min(1).max(max);
const list = (max: number, itemMax: number) => z.array(text(itemMax)).max(max);

export const keyPointSchema = z.object({
  id: slugSchema,
  point: text(400),
  weight: z.number().int().min(1).max(5),
}).strict();

export const packProblemSchema = z.object({
  id: slugSchema,
  title: text(80),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  summary: text(200),
  tags: list(8, 30).min(1),
  estimatedMinutes: z.number().int().min(10).max(180),
  statement: text(6000),
  functionalRequirements: list(15, 300).min(1),
  nonFunctionalRequirements: list(15, 300).min(1),
  scale: z.array(z.object({ label: text(40), value: text(40) }).strict()).max(10),
  peakRps: z.number().int().min(1).max(100_000_000),
  latencyBudgetMs: z.number().int().min(1).max(60_000),
  expectedKinds: z.array(z.enum(componentKinds)).min(1).max(18),
  hints: list(10, 400),
  relatedArticles: z.array(z.string().max(130)).max(10),
  keyPoints: z.array(keyPointSchema).min(3, 'a problem needs at least 3 key points for the judges').max(15),
}).strict().superRefine((problem, context) => {
  const ids = problem.keyPoints.map((item) => item.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['keyPoints'], message: 'key point ids must be unique' });
});

export const packArticleSchema = z.object({
  slug: slugSchema,
  title: text(120),
  category: text(40),
  summary: text(300),
  readingMinutes: z.number().int().min(1).max(60),
  body: text(40_000),
  relatedProblems: z.array(z.string().max(130)).max(10),
}).strict();

export const packManifestSchema = z.object({
  id: slugSchema,
  name: text(60),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'use semantic versioning, e.g. 1.0.0'),
  description: text(400),
  author: text(80),
  license: text(40),
  homepage: z.string().url().max(300).optional(),
  tags: list(10, 30),
}).strict();

export const packBundleSchema = z.object({
  format: z.literal('archon-pack@1'),
  manifest: packManifestSchema,
  problems: z.array(packProblemSchema).max(50),
  articles: z.array(packArticleSchema).max(100),
}).strict().superRefine((bundle, context) => {
  const problemIds = bundle.problems.map((item) => item.id);
  const articleSlugs = bundle.articles.map((item) => item.slug);
  if (new Set(problemIds).size !== problemIds.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['problems'], message: 'problem ids must be unique within the pack' });
  if (new Set(articleSlugs).size !== articleSlugs.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['articles'], message: 'article slugs must be unique within the pack' });
  if (problemIds.length + articleSlugs.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: [], message: 'a pack must contain at least one problem or article' });
});

export const hubIndexSchema = z.object({
  format: z.literal('archon-hub@1'),
  name: text(80),
  updatedAt: z.string(),
  packs: z.array(packManifestSchema.extend({
    problemCount: z.number().int().min(0),
    articleCount: z.number().int().min(0),
    bundle: z.string().min(1).max(500),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    size: z.number().int().min(1),
  }).strict()).max(1000),
}).strict();

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}
