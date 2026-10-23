import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Injectable } from '@nestjs/common';
import { formatZodIssues, hubIndexSchema, packBundleSchema } from '../../../shared/schemas/content';
import type { HubIndex, HubPackEntry, InstalledPack, PackBundle } from '../../../shared/types/entities';
import { AppError, notFound } from '../errors/app-error';
import { SettingsService } from '../settings/settings.service';
import { ContentService } from './content.service';

const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;

export type HubPackStatus = 'available' | 'installed' | 'update';
export interface HubListing {
  source: string;
  name: string | null;
  error: string | null;
  packs: (HubPackEntry & { status: HubPackStatus; installedVersion: string | null })[];
  installed: InstalledPack[];
}

export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) if ((left[index] ?? 0) !== (right[index] ?? 0)) return (left[index] ?? 0) - (right[index] ?? 0);
  return 0;
}

/** Normalises the hub location to a URL: https://..., file://..., or a local path. */
function toUrl(location: string): URL {
  if (/^https?:\/\//i.test(location) || location.startsWith('file:')) return new URL(location);
  if (isAbsolute(location)) return pathToFileURL(location);
  throw new AppError(422, 'VALIDATION_ERROR', 'The hub address must be an http(s) URL or an absolute file path.');
}

async function download(url: URL): Promise<Buffer> {
  if (url.protocol === 'file:') {
    try {
      return await readFile(fileURLToPath(url));
    } catch {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', `Hub file not found: ${fileURLToPath(url)}. Run "npm run hub:build" or point the hub to a published index.`);
    }
  }
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { Accept: 'application/json' } });
  } catch {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', `Could not reach the hub at ${url.host}.`);
  }
  if (!response.ok) throw new AppError(503, 'SERVICE_UNAVAILABLE', `The hub answered HTTP ${response.status} for ${url.pathname}.`);
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_DOWNLOAD_BYTES) throw new AppError(422, 'VALIDATION_ERROR', 'The hub file is larger than 5 MB.');
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_DOWNLOAD_BYTES) throw new AppError(422, 'VALIDATION_ERROR', 'The hub file is larger than 5 MB.');
  return body;
}

function parseJson(buffer: Buffer, what: string): unknown {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new AppError(422, 'VALIDATION_ERROR', `${what} is not valid JSON.`);
  }
}

@Injectable()
export class HubService {
  constructor(private readonly settings: SettingsService, private readonly content: ContentService) {}

  async listing(): Promise<HubListing> {
    const source = (await this.settings.getPublic()).hubUrl;
    const installed = await this.content.listInstalled();
    try {
      const index = await this.fetchIndex(source);
      const packs = index.packs.map((entry) => {
        const current = installed.find((item) => item.manifest.id === entry.id);
        const status: HubPackStatus = !current ? 'available' : compareVersions(entry.version, current.manifest.version) > 0 ? 'update' : 'installed';
        return { ...entry, status, installedVersion: current?.manifest.version ?? null };
      });
      return { source, name: index.name, error: null, packs, installed };
    } catch (error) {
      return { source, name: null, error: error instanceof Error ? error.message : String(error), packs: [], installed };
    }
  }

  async install(packId: string): Promise<InstalledPack> {
    const source = (await this.settings.getPublic()).hubUrl;
    const index = await this.fetchIndex(source);
    const entry = index.packs.find((item) => item.id === packId);
    if (!entry) throw notFound('Hub pack', packId);
    const bundleUrl = new URL(entry.bundle, toUrl(source));
    const raw = await download(bundleUrl);
    const digest = createHash('sha256').update(raw).digest('hex');
    if (digest !== entry.sha256) throw new AppError(422, 'VALIDATION_ERROR', 'The downloaded pack does not match the checksum published by the hub. Installation was cancelled.');
    const bundle = this.validate(parseJson(raw, 'The pack'));
    if (bundle.manifest.id !== entry.id) throw new AppError(422, 'VALIDATION_ERROR', `The hub lists '${entry.id}' but the file contains '${bundle.manifest.id}'.`);
    return this.content.install(bundle, 'hub', digest);
  }

  /** Installs a pack bundle uploaded by the user (local authoring or packs shared outside a hub). */
  async import(raw: unknown): Promise<InstalledPack> {
    const bundle = this.validate(raw);
    const digest = createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
    return this.content.install(bundle, 'import', digest);
  }

  private validate(raw: unknown): PackBundle {
    const result = packBundleSchema.safeParse(raw);
    if (!result.success) throw new AppError(422, 'VALIDATION_ERROR', 'The pack is invalid.', { issues: formatZodIssues(result.error).slice(0, 20) });
    return result.data as PackBundle;
  }

  private async fetchIndex(location: string): Promise<HubIndex> {
    const result = hubIndexSchema.safeParse(parseJson(await download(toUrl(location)), 'The hub index'));
    if (!result.success) throw new AppError(422, 'VALIDATION_ERROR', `The hub index is invalid: ${formatZodIssues(result.error).slice(0, 3).join('; ')}`);
    return result.data as HubIndex;
  }
}
