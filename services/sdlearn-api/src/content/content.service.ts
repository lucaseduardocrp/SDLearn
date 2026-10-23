import { Injectable } from '@nestjs/common';
import { buildCatalog, type Catalog } from '../../../shared/catalog/catalog';
import type { InstalledPack, PackBundle, PracticeSession } from '../../../shared/types/entities';
import { AppError, notFound } from '../errors/app-error';
import { RecordStore } from '../persistence/record-store';

interface StoredPack { installed: InstalledPack; bundle: PackBundle }

/** Built-in problems and articles plus everything installed from the hub, merged into one catalog. */
@Injectable()
export class ContentService {
  private cached: Catalog | null = null;

  constructor(private readonly store: RecordStore) {}

  async catalog(): Promise<Catalog> {
    if (!this.cached) {
      const packs = (await this.store.list<StoredPack>('pack')).sort((a, b) => a.installed.installedAt.localeCompare(b.installed.installedAt));
      this.cached = buildCatalog(packs.map((pack) => pack.bundle));
    }
    return this.cached;
  }

  async getProblem(id: string) {
    const problem = (await this.catalog()).findProblem(id);
    if (problem) return problem;
    const packId = id.includes('.') ? id.split('.')[0] : null;
    if (packId) throw new AppError(404, 'NOT_FOUND', `Problem '${id}' belongs to the pack '${packId}', which is not installed. Install it again from the hub to open this session.`);
    throw notFound('Problem', id);
  }

  async getArticle(slug: string) {
    const article = (await this.catalog()).findArticle(slug);
    if (!article) throw notFound('Article', slug);
    return article;
  }

  async listInstalled(): Promise<InstalledPack[]> {
    return (await this.store.list<StoredPack>('pack')).map((pack) => pack.installed);
  }

  async install(bundle: PackBundle, origin: InstalledPack['origin'], sha256: string | null): Promise<InstalledPack> {
    const installed: InstalledPack = {
      manifest: bundle.manifest, installedAt: new Date().toISOString(), origin, sha256,
      problemCount: bundle.problems.length, articleCount: bundle.articles.length,
    };
    const previous = await this.store.read<StoredPack>('pack', bundle.manifest.id);
    if (previous) installed.installedAt = previous.installed.installedAt;
    await this.store.write<StoredPack>('pack', bundle.manifest.id, { installed, bundle });
    this.cached = null;
    return installed;
  }

  /** Refuses to remove a pack that existing sessions still use unless `force` is set. */
  async uninstall(packId: string, force: boolean): Promise<void> {
    const pack = await this.store.read<StoredPack>('pack', packId);
    if (!pack) throw notFound('Pack', packId);
    const sessions = (await this.store.list<PracticeSession>('session')).filter((session) => session.problemId.startsWith(`${packId}.`));
    if (sessions.length && !force) {
      throw new AppError(409, 'CONFLICT', `${sessions.length} session(s) use problems from this pack. Remove anyway? Those sessions stay saved but cannot be opened until the pack is installed again.`, { sessions: sessions.length });
    }
    await this.store.remove('pack', packId);
    this.cached = null;
  }
}
