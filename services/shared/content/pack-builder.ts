import { parse as parseYaml } from 'yaml';
import type { PackBundle } from '../types/entities';
import { formatZodIssues, packBundleSchema } from '../schemas/content';

export interface SourceFile { path: string; content: string }

export class PackBuildError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid pack:\n- ${issues.join('\n- ')}`);
  }
}

/** Splits `---\nyaml\n---\nmarkdown` into its parts. */
export function parseFrontmatter(source: string, path: string): { data: Record<string, unknown>; body: string } {
  const match = source.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new PackBuildError([`${path}: missing YAML frontmatter (the file must start with ---)`]);
  const data = parseYaml(match[1]) as unknown;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new PackBuildError([`${path}: frontmatter must be a YAML mapping`]);
  return { data: data as Record<string, unknown>, body: match[2].trim() };
}

/**
 * Builds a pack bundle from a pack folder:
 *   pack.yaml            manifest
 *   problems/<id>.md     frontmatter = problem fields, body = statement
 *   articles/<slug>.md   frontmatter = article fields, body = article markdown
 * The file name (without .md) is the id/slug unless the frontmatter sets one.
 */
export function buildPack(files: SourceFile[]): PackBundle {
  const issues: string[] = [];
  const normalized = files.map((file) => ({ ...file, path: file.path.replace(/\\/g, '/').replace(/^\.\//, '') }));
  const manifestFile = normalized.find((file) => file.path === 'pack.yaml' || file.path === 'pack.yml');
  if (!manifestFile) throw new PackBuildError(['pack.yaml is missing']);

  const manifest = parseYaml(manifestFile.content) as unknown;
  const problems: unknown[] = [];
  const articles: unknown[] = [];
  for (const file of normalized) {
    const kind = file.path.match(/^(problems|articles)\/([^/]+)\.md$/);
    if (!kind) continue;
    try {
      const { data, body } = parseFrontmatter(file.content, file.path);
      if (kind[1] === 'problems') problems.push({ id: kind[2], ...data, statement: body });
      else articles.push({ slug: kind[2], ...data, body });
    } catch (error) {
      issues.push(...(error instanceof PackBuildError ? error.issues : [`${file.path}: ${String(error)}`]));
    }
  }
  if (issues.length) throw new PackBuildError(issues);

  const result = packBundleSchema.safeParse({ format: 'archon-pack@1', manifest, problems, articles });
  if (!result.success) {
    const labelled = formatZodIssues(result.error).map((issue) => issue
      .replace(/^problems\.(\d+)/, (_match, index: string) => `problems/${String((problems[Number(index)] as { id?: string }).id)}.md`)
      .replace(/^articles\.(\d+)/, (_match, index: string) => `articles/${String((articles[Number(index)] as { slug?: string }).slug)}.md`));
    throw new PackBuildError(labelled);
  }
  return result.data as PackBundle;
}
