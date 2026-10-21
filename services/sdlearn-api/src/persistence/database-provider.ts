import { DefaultAzureCredential } from '@azure/identity';
import { Pool, type PoolConfig } from 'pg';
import type { AppConfig } from '../config/app-config';

export interface DatabaseProvider {
  createPool(): Pool;
}

export class DevelopmentPostgresProvider implements DatabaseProvider {
  constructor(private readonly config: AppConfig) {}

  createPool(): Pool {
    return new Pool({ connectionString: this.config.databaseUrl, max: 10, idleTimeoutMillis: 30000 });
  }
}

export class ManagedIdentityPostgresProvider implements DatabaseProvider {
  constructor(private readonly config: AppConfig) {}

  createPool(): Pool {
    const credential = new DefaultAzureCredential();
    const poolConfig: PoolConfig = {
      host: this.config.databaseHost,
      database: this.config.databaseName,
      user: this.config.databaseUser,
      port: 5432,
      ssl: { rejectUnauthorized: true },
      max: 10,
      idleTimeoutMillis: 30000,
      password: async () => {
        const token = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');
        if (!token) throw new Error('Managed identity did not return a PostgreSQL access token.');
        return token.token;
      },
    };
    return new Pool(poolConfig);
  }
}

export function createDatabaseProvider(config: AppConfig): DatabaseProvider {
  return config.environment === 'Development'
    ? new DevelopmentPostgresProvider(config)
    : new ManagedIdentityPostgresProvider(config);
}