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
  AZURE_OPENAI_ENDPOINT: optionalUrl,
  AZURE_OPENAI_DEPLOYMENT: optionalSetting,
  AZURE_OPENAI_API_KEY: optionalSetting,
  AZURE_OPENAI_API_VERSION: z.string().default('2024-10-21'),
});

export interface AppConfig {
  environment: string;
  port: number;
  databaseUrl?: string;
  databaseHost?: string;
  databaseName?: string;
  databaseUser?: string;
  azureOpenAiEndpoint?: string;
  azureOpenAiDeployment?: string;
  azureOpenAiApiKey?: string;
  azureOpenAiApiVersion: string;
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
    azureOpenAiEndpoint: values.AZURE_OPENAI_ENDPOINT,
    azureOpenAiDeployment: values.AZURE_OPENAI_DEPLOYMENT,
    azureOpenAiApiKey: values.AZURE_OPENAI_API_KEY,
    azureOpenAiApiVersion: values.AZURE_OPENAI_API_VERSION,
  };
}