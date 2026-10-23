import Anthropic from '@anthropic-ai/sdk';
import { DefaultAzureCredential } from '@azure/identity';
import type { ProviderId } from '../../../shared/types/entities';

export interface JsonRequest {
  system: string;
  user: string;
  /** JSON schema for the answer; every object is closed and lists all properties as required. */
  schema: Record<string, unknown>;
  schemaName: string;
}

export interface LlmProvider {
  readonly id: ProviderId;
  /** Sends one request that must answer with a single JSON object and returns the parsed object. */
  completeJson(model: string, request: JsonRequest): Promise<unknown>;
  listModels(): Promise<string[]>;
}

export interface ProviderCredentials {
  apiKey?: string;
  baseUrl?: string;
  /** Azure OpenAI deployment name. */
  deployment?: string;
  azureApiVersion?: string;
}

export const providerLabels: Record<ProviderId, string> = {
  openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google Gemini', xai: 'Grok (xAI)', ollama: 'Ollama (local)', 'azure-openai': 'Azure OpenAI',
};

export const defaultBaseUrls: Record<ProviderId, string | null> = {
  openai: 'https://api.openai.com/v1', anthropic: null, gemini: 'https://generativelanguage.googleapis.com', xai: 'https://api.x.ai/v1', ollama: 'http://localhost:11434', 'azure-openai': null,
};

export class ProviderError extends Error {}

const REQUEST_TIMEOUT_MS = 180_000;
const trimSlash = (value: string) => value.replace(/\/+$/, '');

function parseJsonText(content: string | undefined | null): unknown {
  if (!content) throw new ProviderError('The model returned an empty answer.');
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end < start) throw new ProviderError('The model did not answer with JSON.');
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    throw new ProviderError('The model answered with malformed JSON.');
  }
}

async function readJsonResponse(response: Response, provider: string): Promise<unknown> {
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
    throw new ProviderError(`${provider} returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return response.json();
}

/** OpenAI and xAI (Grok) share the Chat Completions API. */
class OpenAiCompatibleProvider implements LlmProvider {
  constructor(readonly id: 'openai' | 'xai', private readonly credentials: ProviderCredentials) {}

  private get baseUrl() { return trimSlash(this.credentials.baseUrl || defaultBaseUrls[this.id]!); }
  private headers() {
    return { 'Content-Type': 'application/json', ...(this.credentials.apiKey ? { Authorization: `Bearer ${this.credentials.apiKey}` } : {}) };
  }

  async completeJson(model: string, request: JsonRequest): Promise<unknown> {
    const send = (responseFormat: Record<string, unknown>) => fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST', headers: this.headers(), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({ model, response_format: responseFormat, messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.user }] }),
    });
    let response = await send({ type: 'json_schema', json_schema: { name: request.schemaName, schema: request.schema, strict: true } });
    // Some compatible servers and older models only accept JSON mode; the schema is still enforced by validation.
    if (response.status === 400) response = await send({ type: 'json_object' });
    const body = await readJsonResponse(response, providerLabels[this.id]) as { choices?: Array<{ message?: { content?: string; refusal?: string } }> };
    const message = body.choices?.[0]?.message;
    if (message?.refusal) throw new ProviderError(`The model refused: ${message.refusal}`);
    return parseJsonText(message?.content);
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/models`, { headers: this.headers(), signal: AbortSignal.timeout(20_000) });
    const body = await readJsonResponse(response, providerLabels[this.id]) as { data?: Array<{ id: string }> };
    return (body.data ?? []).map((model) => model.id).sort();
  }
}

/** Claude through the official Anthropic SDK with structured outputs. */
class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic' as const;
  private readonly client: Anthropic;

  constructor(private readonly credentials: ProviderCredentials) {
    this.client = new Anthropic({ apiKey: credentials.apiKey, baseURL: credentials.baseUrl || undefined, timeout: REQUEST_TIMEOUT_MS, maxRetries: 2 });
  }

  async completeJson(model: string, request: JsonRequest): Promise<unknown> {
    // Server-side fallback keeps a judgement going when a safety classifier declines; only these models accept it.
    const fallbackModels = ['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5'];
    const useFallback = fallbackModels.includes(model) && !this.credentials.baseUrl;
    try {
      const response = await this.client.beta.messages.create({
        model,
        max_tokens: 16000,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
        output_config: { effort: 'high', format: { type: 'json_schema', schema: request.schema } },
        ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      });
      if (response.stop_reason === 'refusal') throw new ProviderError('Claude declined to evaluate this submission.');
      if (response.stop_reason === 'max_tokens') throw new ProviderError('Claude hit the output limit before finishing the JSON answer.');
      const text = response.content.flatMap((block) => block.type === 'text' ? [block.text] : []).join('');
      return parseJsonText(text);
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) throw new ProviderError('Anthropic rejected the API key.');
      if (error instanceof Anthropic.RateLimitError) throw new ProviderError('Anthropic rate limit reached; try again shortly.');
      if (error instanceof Anthropic.NotFoundError) throw new ProviderError(`Anthropic does not know the model "${model}".`);
      if (error instanceof Anthropic.APIError) throw new ProviderError(`Anthropic returned HTTP ${error.status ?? '?'}: ${error.message}`);
      throw error;
    }
  }

  async listModels(): Promise<string[]> {
    const ids: string[] = [];
    for await (const model of this.client.models.list({ limit: 100 })) ids.push(model.id);
    return ids;
  }
}

class GeminiProvider implements LlmProvider {
  readonly id = 'gemini' as const;
  constructor(private readonly credentials: ProviderCredentials) {}

  private get baseUrl() { return trimSlash(this.credentials.baseUrl || defaultBaseUrls.gemini!); }
  private headers() { return { 'Content-Type': 'application/json', 'x-goog-api-key': this.credentials.apiKey ?? '' }; }

  async completeJson(model: string, request: JsonRequest): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: this.headers(), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts: [{ text: request.user }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    const body = await readJsonResponse(response, 'Gemini') as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>; promptFeedback?: { blockReason?: string } };
    if (body.promptFeedback?.blockReason) throw new ProviderError(`Gemini blocked the request: ${body.promptFeedback.blockReason}`);
    const candidate = body.candidates?.[0];
    if (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) throw new ProviderError(`Gemini stopped early: ${candidate.finishReason}`);
    return parseJsonText(candidate?.content?.parts?.map((part) => part.text ?? '').join(''));
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/v1beta/models?pageSize=200`, { headers: this.headers(), signal: AbortSignal.timeout(20_000) });
    const body = await readJsonResponse(response, 'Gemini') as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    return (body.models ?? []).filter((model) => model.supportedGenerationMethods?.includes('generateContent')).map((model) => model.name.replace(/^models\//, '')).sort();
  }
}

class OllamaProvider implements LlmProvider {
  readonly id = 'ollama' as const;
  constructor(private readonly credentials: ProviderCredentials) {}

  private get baseUrl() { return trimSlash(this.credentials.baseUrl || defaultBaseUrls.ollama!); }

  async completeJson(model: string, request: JsonRequest): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(600_000),
        body: JSON.stringify({ model, stream: false, format: request.schema, options: { temperature: 0.2 }, messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.user }] }),
      });
    } catch {
      throw new ProviderError(`Could not reach Ollama at ${this.baseUrl}. Is it running (ollama serve)?`);
    }
    const body = await readJsonResponse(response, 'Ollama') as { message?: { content?: string } };
    return parseJsonText(body.message?.content);
  }

  async listModels(): Promise<string[]> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new ProviderError(`Could not reach Ollama at ${this.baseUrl}. Is it running (ollama serve)?`);
    }
    const body = await readJsonResponse(response, 'Ollama') as { models?: Array<{ name: string }> };
    return (body.models ?? []).map((model) => model.name).sort();
  }
}

class AzureOpenAiProvider implements LlmProvider {
  readonly id = 'azure-openai' as const;
  private readonly credential = new DefaultAzureCredential();
  constructor(private readonly credentials: ProviderCredentials) {}

  async completeJson(model: string, request: JsonRequest): Promise<unknown> {
    const deployment = model || this.credentials.deployment;
    if (!this.credentials.baseUrl || !deployment) throw new ProviderError('Azure OpenAI needs an endpoint and a deployment.');
    const url = `${trimSlash(this.credentials.baseUrl)}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(this.credentials.azureApiVersion ?? '2024-10-21')}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.credentials.apiKey) {
      headers['api-key'] = this.credentials.apiKey;
    } else {
      const token = await this.credential.getToken('https://cognitiveservices.azure.com/.default');
      if (!token) throw new ProviderError('Managed identity did not return an Azure OpenAI access token.');
      headers.Authorization = `Bearer ${token.token}`;
    }
    const response = await fetch(url, {
      method: 'POST', headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({ response_format: { type: 'json_object' }, messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.user }] }),
    });
    const body = await readJsonResponse(response, 'Azure OpenAI') as { choices?: Array<{ message?: { content?: string } }> };
    return parseJsonText(body.choices?.[0]?.message?.content);
  }

  async listModels(): Promise<string[]> {
    return this.credentials.deployment ? [this.credentials.deployment] : [];
  }
}

export function createProvider(id: ProviderId, credentials: ProviderCredentials): LlmProvider {
  switch (id) {
    case 'openai':
    case 'xai': return new OpenAiCompatibleProvider(id, credentials);
    case 'anthropic': return new AnthropicProvider(credentials);
    case 'gemini': return new GeminiProvider(credentials);
    case 'ollama': return new OllamaProvider(credentials);
    case 'azure-openai': return new AzureOpenAiProvider(credentials);
  }
}
