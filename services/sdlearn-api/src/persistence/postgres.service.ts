import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { createDatabaseProvider } from './database-provider';

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.pool = createDatabaseProvider(config).createPool();
  }

  query<Row extends QueryResultRow = QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<Row>> {
    return this.pool.query<Row>({ text, values: [...values] as never[] });
  }

  async onModuleInit(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS sdlearn_records (
        kind text NOT NULL,
        id text NOT NULL,
        payload jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (kind, id)
      )
    `);
    await this.query('CREATE INDEX IF NOT EXISTS sdlearn_records_updated_idx ON sdlearn_records (kind, updated_at DESC)');
    const encoding = await this.query<{ server_encoding: string }>('SHOW server_encoding');
    if (encoding.rows[0]?.server_encoding !== 'UTF8') {
      this.logger.warn(`Database encoding is ${encoding.rows[0]?.server_encoding}; SDLearn stores Unicode text and requires a UTF8 database.`);
    }
  }

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}