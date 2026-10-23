import type { Article, ContentSource, PackBundle, Problem } from '../types/entities';
import { articles as coreArticles } from './articles';
import { problems as coreProblems } from './problems';

export interface Catalog {
  problems: Problem[];
  articles: Article[];
  findProblem(id: string): Problem | undefined;
  findArticle(slug: string): Article | undefined;
}

/** Ids of pack content are namespaced by pack so community packs can never collide with each other or the core. */
export function namespacedId(packId: string, localId: string): string {
  return `${packId}.${localId}`;
}

/**
 * Merges the built-in catalog with installed packs. Cross references inside a pack may use the pack's
 * local ids or any built-in id; references that resolve to neither are dropped.
 */
export function buildCatalog(bundles: PackBundle[] = []): Catalog {
  const problems: Problem[] = [...coreProblems];
  const articles: Article[] = [...coreArticles];
  const coreProblemIds = new Set(coreProblems.map((problem) => problem.id));
  const coreArticleSlugs = new Set(coreArticles.map((article) => article.slug));
  let nextNumber = Math.max(0, ...coreProblems.map((problem) => problem.number)) + 1;

  for (const bundle of bundles) {
    const { manifest } = bundle;
    const source: ContentSource = { packId: manifest.id, packName: manifest.name, version: manifest.version };
    const localProblems = new Set(bundle.problems.map((problem) => problem.id));
    const localArticles = new Set(bundle.articles.map((article) => article.slug));
    const resolveProblem = (id: string) => localProblems.has(id) ? namespacedId(manifest.id, id) : coreProblemIds.has(id) ? id : null;
    const resolveArticle = (slug: string) => localArticles.has(slug) ? namespacedId(manifest.id, slug) : coreArticleSlugs.has(slug) ? slug : null;

    for (const problem of bundle.problems) {
      problems.push({
        ...problem,
        id: namespacedId(manifest.id, problem.id),
        number: nextNumber++,
        relatedArticles: problem.relatedArticles.map(resolveArticle).filter((slug): slug is string => slug !== null),
        source,
      });
    }
    for (const article of bundle.articles) {
      articles.push({
        ...article,
        slug: namespacedId(manifest.id, article.slug),
        relatedProblems: article.relatedProblems.map(resolveProblem).filter((id): id is string => id !== null),
        source,
      });
    }
  }

  const problemIndex = new Map(problems.map((problem) => [problem.id, problem]));
  const articleIndex = new Map(articles.map((article) => [article.slug, article]));
  return {
    problems,
    articles,
    findProblem: (id) => problemIndex.get(id),
    findArticle: (slug) => articleIndex.get(slug),
  };
}

export const coreCatalog = buildCatalog();
