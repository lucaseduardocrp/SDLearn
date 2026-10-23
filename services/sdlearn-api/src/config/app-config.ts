import { resolve } from 'node:path';
import { z } from 'zod';

const optionalUrl = z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional());
const optionalSetting = z.preprocess((value) => value === '' ? undefined : value, z.string().optional());
const environmentSchema = z.object({
  APP_ENV: z.string().default('Production'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: optionalSetting,
  PGHOST: optionalSetting,
  PGDATABASE: optionalSetting,
  PGUSER: optionalSetting,
  JUDGE_PROVIDER: z.preprocess((value) => value === '' ? undefined : value, z.enum(['azure-openai', 'openai', 'none']).optional()),
  AZURE_OPENAI_ENDPOINT: optionalUrl,
  AZURE_OPENAI_DEPLOYMENT: optionalSetting,
  AZURE_OPENAI_API_KEY: optionalSetting,
  AZURE_OPENAI_API_VERSION: z.string().default('2024-10-21'),
  OPENAI_API_KEY: optionalSetting,
  OPENAI_BASE_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().default('https://api.openai.com/v1')),
  OPENAI_MODEL: z.preprocess((value) => value === '' ? undefined : value, z.string().default('gpt-4.1-mini')),
  ANTHROPIC_API_KEY: optionalSetting,
  GEMINI_API_KEY: optionalSetting,
  XAI_API_KEY: optionalSetting,
  OLLAMA_BASE_URL: optionalUrl,
  SECRETS_KEY: optionalSetting,
  HUB_INDEX_URL: optionalSetting,
});

export interface AppConfig {
  environment: string;
  port: number;
  databaseUrl?: string;
  databaseHost?: string;
  databaseName?: string;
  databaseUser?: string;
  judgeProvider?: 'azure-openai' | 'openai' | 'none';
  azureOpenAiEndpoint?: string;
  azureOpenAiDeployment?: string;
  azureOpenAiApiKey?: string;
  azureOpenAiApiVersion: string;
  openAiApiKey?: string;
  openAiBaseUrl?: string;
  openAiModel?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  xaiApiKey?: string;
  ollamaBaseUrl?: string;
  /** Encrypts provider API keys saved from the settings page. */
  secretsKey?: string;
  /** Hub index location (https URL or file path). Defaults to the hub/ folder in this repository. */
  hubIndexUrl: string;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(`Invalid application configuration: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  const values = parsed.data;
  if (values.APP_ENV === 'Development') {
    if (!values.DATABASE_URL) throw new Error('DATABASE_URL is required in Development.');
  } else if (!values.PGHOST || !values.PGDATABASE || !values.PGUSER) {
    throw new Error('PGHOST, PGDATABASE, and PGUSER are required outside Development.');
  }
  return {
    environment: values.APP_ENV,
    port: values.PORT,
    databaseUrl: values.DATABASE_URL,
    databaseHost: values.PGHOST,
    databaseName: values.PGDATABASE,
    databaseUser: values.PGUSER,
    judgeProvider: values.JUDGE_PROVIDER,
    azureOpenAiEndpoint: values.AZURE_OPENAI_ENDPOINT,
    azureOpenAiDeployment: values.AZURE_OPENAI_DEPLOYMENT,
    azureOpenAiApiKey: values.AZURE_OPENAI_API_KEY,
    azureOpenAiApiVersion: values.AZURE_OPENAI_API_VERSION,
    openAiApiKey: values.OPENAI_API_KEY,
    openAiBaseUrl: values.OPENAI_BASE_URL,
    openAiModel: values.OPENAI_MODEL,
    anthropicApiKey: values.ANTHROPIC_API_KEY,
    geminiApiKey: values.GEMINI_API_KEY,
    xaiApiKey: values.XAI_API_KEY,
    ollamaBaseUrl: values.OLLAMA_BASE_URL,
    secretsKey: values.SECRETS_KEY,
    hubIndexUrl: values.HUB_INDEX_URL ?? resolve(__dirname, '../../../../../../hub/dist/index.json'),
  };
}
