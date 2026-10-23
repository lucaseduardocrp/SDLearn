import { Inject, Injectable } from '@nestjs/common';
import { localized } from '../../../shared/i18n/locale';
import type { JudgeAssignment, JudgeRole, ProviderId, ProviderStatus, PublicSettings, SettingsUpdate } from '../../../shared/types/entities';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { AppError } from '../errors/app-error';
import { createProvider, defaultBaseUrls, providerLabels, type LlmProvider, type ProviderCredentials } from '../judges/llm-provider';
import { RecordStore } from '../persistence/record-store';
import { SecretBox } from './secret-box';

export const PROVIDER_IDS: ProviderId[] = ['openai', 'anthropic', 'gemini', 'xai', 'ollama', 'azure-openai'];
export const JUDGE_ROLES: JudgeRole[] = ['rigor', 'pragmatic', 'moderator'];
const NEEDS_KEY: Record<ProviderId, boolean> = { openai: true, anthropic: true, gemini: true, xai: true, ollama: false, 'azure-openai': false };

interface StoredProvider { apiKey?: string; baseUrl?: string; deployment?: string; enabled?: boolean }
interface StoredSettings {
  providers: Partial<Record<ProviderId, StoredProvider>>;
  judges: Partial<Record<JudgeRole, JudgeAssignment>>;
  samples: 1 | 3;
  hubUrl?: string;
}

export interface JudgeRunner { provider: LlmProvider; model: string; label: string }
export interface JudgeSetup { runners: Record<JudgeRole, JudgeRunner>; samples: 1 | 3 }

@Injectable()
export class SettingsService {
  private readonly box: SecretBox;

  constructor(private readonly store: RecordStore, @Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.box = new SecretBox(config.secretsKey);
  }

  async getPublic(): Promise<PublicSettings> {
    const stored = await this.load();
    const providers = PROVIDER_IDS.map((id) => this.status(id, stored));
    const judges = Object.fromEntries(JUDGE_ROLES.map((role) => [role, this.assignment(role, stored, providers)])) as Record<JudgeRole, JudgeAssignment>;
    return { providers, judges, samples: stored.samples, hubUrl: stored.hubUrl ?? this.config.hubIndexUrl, secretsEncrypted: this.box.encrypted };
  }

  async update(input: SettingsUpdate): Promise<PublicSettings> {
    const stored = await this.load();
    for (const [id, patch] of Object.entries(input.providers ?? {}) as [ProviderId, NonNullable<SettingsUpdate['providers']>[ProviderId]][]) {
      if (!patch) continue;
      const current: StoredProvider = { ...stored.providers[id] };
      if (patch.apiKey === null) delete current.apiKey;
      else if (typeof patch.apiKey === 'string' && patch.apiKey.trim()) current.apiKey = this.box.seal(patch.apiKey.trim());
      for (const field of ['baseUrl', 'deployment'] as const) {
        if (patch[field] === null || patch[field] === '') delete current[field];
        else if (typeof patch[field] === 'string') current[field] = patch[field]!.trim().replace(/\/+$/, '');
      }
      if (id === 'ollama') current.enabled = true;
      stored.providers[id] = current;
    }
    for (const [role, assignment] of Object.entries(input.judges ?? {}) as [JudgeRole, JudgeAssignment][]) {
      stored.judges[role] = { provider: assignment.provider, model: assignment.model?.trim() || null };
    }
    if (input.samples) stored.samples = input.samples;
    if (input.hubUrl !== undefined) stored.hubUrl = input.hubUrl.trim() || undefined;
    await this.store.write('settings', 'app', stored);
    return this.getPublic();
  }

  /** Builds a provider client from saved settings, falling back to environment variables. */
  async provider(id: ProviderId): Promise<LlmProvider> {
    const credentials = this.credentials(id, await this.load());
    if (!credentials) throw new AppError(422, 'VALIDATION_ERROR', localized(`${providerLabels[id]} não está configurado.`, `${providerLabels[id]} is not configured.`));
    return createProvider(id, credentials);
  }

  /** Returns the judge setup, or null when any role is missing a configured provider and model. */
  async judgeSetup(): Promise<JudgeSetup | null> {
    const stored = await this.load();
    const settings = await this.getPublic();
    const runners = {} as Record<JudgeRole, JudgeRunner>;
    for (const role of JUDGE_ROLES) {
      const { provider, model } = settings.judges[role];
      const credentials = provider ? this.credentials(provider, stored) : null;
      if (!provider || !model || !credentials) return null;
      runners[role] = { provider: createProvider(provider, credentials), model, label: `${providerLabels[provider]} · ${model}` };
    }
    return { runners, samples: stored.samples };
  }

  private credentials(id: ProviderId, stored: StoredSettings): ProviderCredentials | null {
    const saved = stored.providers[id] ?? {};
    const apiKey = (saved.apiKey ? this.box.open(saved.apiKey) : null) ?? this.envKey(id);
    const baseUrl = saved.baseUrl ?? this.envBaseUrl(id);
    const deployment = saved.deployment ?? (id === 'azure-openai' ? this.config.azureOpenAiDeployment : undefined);
    if (id === 'ollama') return saved.enabled || this.config.ollamaBaseUrl ? { baseUrl } : null;
    if (id === 'azure-openai') {
      if (!baseUrl || !deployment) return null;
      if (!apiKey && this.config.environment === 'Development') return null;
      return { apiKey: apiKey ?? undefined, baseUrl, deployment, azureApiVersion: this.config.azureOpenAiApiVersion };
    }
    // A custom OpenAI-compatible endpoint (LM Studio, vLLM, a proxy) may not need a key.
    if (id === 'openai' && !apiKey && baseUrl) return { baseUrl };
    return apiKey ? { apiKey, baseUrl } : null;
  }

  private status(id: ProviderId, stored: StoredSettings): ProviderStatus {
    const saved = stored.providers[id] ?? {};
    const configured = this.credentials(id, stored) !== null;
    const savedKey = saved.apiKey ? this.box.open(saved.apiKey) : null;
    const key = savedKey ?? this.envKey(id);
    const fromSettings = Boolean(savedKey || saved.baseUrl || saved.deployment || saved.enabled);
    return {
      id, label: providerLabels[id], configured, needsKey: NEEDS_KEY[id],
      keyHint: key ? `••••${key.slice(-4)}` : null,
      baseUrl: saved.baseUrl ?? this.envBaseUrl(id) ?? defaultBaseUrls[id],
      deployment: saved.deployment ?? (id === 'azure-openai' ? this.config.azureOpenAiDeployment ?? null : null),
      source: !configured ? null : fromSettings ? 'settings' : 'env',
    };
  }

  /** Explicit choice from settings, otherwise a sensible default derived from what is configured. */
  private assignment(role: JudgeRole, stored: StoredSettings, providers: ProviderStatus[]): JudgeAssignment {
    const explicit = stored.judges[role];
    if (explicit?.provider) return explicit;
    if (this.config.judgeProvider === 'none') return { provider: null, model: null };
    const ready = (id: ProviderId) => providers.find((item) => item.id === id)?.configured;
    if (ready('azure-openai') && this.config.judgeProvider !== 'openai') return { provider: 'azure-openai', model: this.config.azureOpenAiDeployment ?? null };
    if (ready('openai')) return { provider: 'openai', model: this.config.openAiModel ?? null };
    if (ready('anthropic')) return { provider: 'anthropic', model: 'claude-opus-5-5' };
    return { provider: null, model: null };
  }

  private envKey(id: ProviderId): string | null {
    const keys: Record<ProviderId, string | undefined> = {
      openai: this.config.openAiApiKey, anthropic: this.config.anthropicApiKey, gemini: this.config.geminiApiKey,
      xai: this.config.xaiApiKey, ollama: undefined, 'azure-openai': this.config.azureOpenAiApiKey,
    };
    return keys[id] ?? null;
  }

  private envBaseUrl(id: ProviderId): string | undefined {
    if (id === 'openai' && this.config.openAiBaseUrl && this.config.openAiBaseUrl !== defaultBaseUrls.openai) return this.config.openAiBaseUrl;
    if (id === 'ollama') return this.config.ollamaBaseUrl;
    if (id === 'azure-openai') return this.config.azureOpenAiEndpoint;
    return undefined;
  }

  private async load(): Promise<StoredSettings> {
    const stored = await this.store.read<StoredSettings>('settings', 'app');
    return { providers: stored?.providers ?? {}, judges: stored?.judges ?? {}, samples: stored?.samples ?? 1, hubUrl: stored?.hubUrl };
  }
}
