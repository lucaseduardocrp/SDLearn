import { DefaultAzureCredential } from '@azure/identity';
import type { AppConfig } from '../config/app-config';

export interface LlmProvider {
  readonly name: string;
  /** Sends a chat completion that must answer with a single JSON object and returns the parsed object. */
  completeJson(system: string, user: string): Promise<unknown>;
}

type ChatBody = { choices?: Array<{ message?: { content?: string } }> };

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`Judge provider returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  const body = await response.json() as ChatBody;
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('Judge provider returned an empty message.');
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Judge provider did not return JSON.');
  return JSON.parse(content.slice(start, end + 1));
}

export class AzureOpenAiProvider implements LlmProvider {
  readonly name: string;
  private readonly credential = new DefaultAzureCredential();

  constructor(private readonly config: AppConfig) {
    this.name = `Azure OpenAI (${config.azureOpenAiDeployment})`;
  }

  async completeJson(system: string, user: string): Promise<unknown> {
    const { azureOpenAiEndpoint, azureOpenAiDeployment, azureOpenAiApiKey, azureOpenAiApiVersion } = this.config;
    const url = `${azureOpenAiEndpoint!.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(azureOpenAiDeployment!)}/chat/completions?api-version=${encodeURIComponent(azureOpenAiApiVersion)}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (azureOpenAiApiKey) {
      headers['api-key'] = azureOpenAiApiKey;
    } else {
      const token = await this.credential.getToken('https://cognitiveservices.azure.com/.default');
      if (!token) throw new Error('Managed identity did not return an Azure OpenAI access token.');
      headers.Authorization = `Bearer ${token.token}`;
    }
    const response = await fetch(url, {
      method: 'POST', headers, signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({ temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    return readJson(response);
  }
}

/** Works with OpenAI and any OpenAI-compatible endpoint (Ollama, OpenRouter, vLLM, LM Studio...). */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;

  constructor(private readonly config: AppConfig) {
    this.name = `${config.openAiModel} @ ${new URL(config.openAiBaseUrl!).host}`;
  }

  async completeJson(system: string, user: string): Promise<unknown> {
    const response = await fetch(`${this.config.openAiBaseUrl!.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal: AbortSignal.timeout(90_000),
      headers: { 'Content-Type': 'application/json', ...(this.config.openAiApiKey ? { Authorization: `Bearer ${this.config.openAiApiKey}` } : {}) },
      body: JSON.stringify({ model: this.config.openAiModel, temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    return readJson(response);
  }
}

export function createLlmProvider(config: AppConfig): LlmProvider | null {
  const azureReady = Boolean(config.azureOpenAiEndpoint && config.azureOpenAiDeployment && (config.azureOpenAiApiKey || config.environment !== 'Development'));
  const openAiReady = Boolean(config.openAiApiKey || (config.openAiBaseUrl && !config.openAiBaseUrl.includes('api.openai.com')));
  switch (config.judgeProvider) {
    case 'none': return null;
    case 'azure-openai': return azureReady ? new AzureOpenAiProvider(config) : null;
    case 'openai': return openAiReady ? new OpenAiCompatibleProvider(config) : null;
    default:
      if (azureReady) return new AzureOpenAiProvider(config);
      if (config.openAiApiKey) return new OpenAiCompatibleProvider(config);
      return null;
  }
}
