import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Injectable } from '@nestjs/common';
import { defaultLocale, localized, type Locale, type Localized } from '../../../shared/i18n/locale';
import { formatZodIssues, hubIndexSchema, packBundleSchema } from '../../../shared/schemas/content';
import type { HubIndex, HubPackEntry, InstalledPack, PackBundle } from '../../../shared/types/entities';
import { AppError, errorMessage, notFound } from '../errors/app-error';
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
  throw new AppError(422, 'VALIDATION_ERROR', localized('O endereço do hub precisa ser uma URL http(s) ou um caminho absoluto de arquivo.', 'The hub address must be an http(s) URL or an absolute file path.'));
}

async function download(url: URL): Promise<Buffer> {
  if (url.protocol === 'file:') {
    try {
      return await readFile(fileURLToPath(url));
    } catch {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', localized(
        `Arquivo do hub não encontrado: ${fileURLToPath(url)}. Rode "npm run hub:build" ou aponte o hub para um índice publicado.`,
        `Hub file not found: ${fileURLToPath(url)}. Run "npm run hub:build" or point the hub to a published index.`,
      ));
    }
  }
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { Accept: 'application/json' } });
  } catch {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', localized(`Não foi possível acessar o hub em ${url.host}.`, `Could not reach the hub at ${url.host}.`));
  }
  if (!response.ok) throw new AppError(503, 'SERVICE_UNAVAILABLE', localized(`O hub respondeu HTTP ${response.status} para ${url.pathname}.`, `The hub answered HTTP ${response.status} for ${url.pathname}.`));
  const declared = Number(response.headers.get('content-length') ?? 0);
  const tooLarge = localized('O arquivo do hub tem mais de 5 MB.', 'The hub file is larger than 5 MB.');
  if (declared > MAX_DOWNLOAD_BYTES) throw new AppError(422, 'VALIDATION_ERROR', tooLarge);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_DOWNLOAD_BYTES) throw new AppError(422, 'VALIDATION_ERROR', tooLarge);
  return body;
}

function parseJson(buffer: Buffer, what: Localized): unknown {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new AppError(422, 'VALIDATION_ERROR', localized(`${what['pt-BR']} não é um JSON válido.`, `${what.en} is not valid JSON.`));
  }
}

@Injectable()
export class HubService {
  constructor(private readonly settings: SettingsService, private readonly content: ContentService) {}

  async listing(locale: Locale = defaultLocale): Promise<HubListing> {
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
      return { source, name: null, error: errorMessage(error, locale), packs: [], installed };
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
    if (digest !== entry.sha256) throw new AppError(422, 'VALIDATION_ERROR', localized(
      'O pacote baixado não confere com o checksum publicado pelo hub. A instalação foi cancelada.',
      'The downloaded pack does not match the checksum published by the hub. Installation was cancelled.',
    ));
    const bundle = this.validate(parseJson(raw, localized('O pacote', 'The pack')));
    if (bundle.manifest.id !== entry.id) throw new AppError(422, 'VALIDATION_ERROR', localized(`O hub lista '${entry.id}', mas o arquivo contém '${bundle.manifest.id}'.`, `The hub lists '${entry.id}' but the file contains '${bundle.manifest.id}'.`));
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
    if (!result.success) throw new AppError(422, 'VALIDATION_ERROR', localized('O pacote é inválido.', 'The pack is invalid.'), { issues: formatZodIssues(result.error).slice(0, 20) });
    return result.data as PackBundle;
  }

  private async fetchIndex(location: string): Promise<HubIndex> {
    const result = hubIndexSchema.safeParse(parseJson(await download(toUrl(location)), localized('O índice do hub', 'The hub index')));
    if (!result.success) {
      const issues = formatZodIssues(result.error).slice(0, 3).join('; ');
      throw new AppError(422, 'VALIDATION_ERROR', localized(`O índice do hub é inválido: ${issues}`, `The hub index is invalid: ${issues}`));
    }
    return result.data as HubIndex;
  }
}
