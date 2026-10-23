import { Injectable } from '@nestjs/common';
import { PostgresService } from './postgres.service';

/** Typed JSONB document store over the `sdlearn_records` table, keyed by (kind, id). */
@Injectable()
export class RecordStore {
  constructor(private readonly db: PostgresService) {}

  async read<T>(kind: string, id: string): Promise<T | null> {
    const result = await this.db.query<{ payload: T }>('SELECT payload FROM sdlearn_records WHERE kind = $1 AND id = $2', [kind, id]);
    return result.rows[0]?.payload ?? null;
  }

  async list<T>(kind: string): Promise<T[]> {
    const result = await this.db.query<{ payload: T }>('SELECT payload FROM sdlearn_records WHERE kind = $1 ORDER BY updated_at DESC', [kind]);
    return result.rows.map((row) => row.payload);
  }

  async write<T>(kind: string, id: string, payload: T): Promise<T> {
    await this.db.query('INSERT INTO sdlearn_records (kind, id, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT (kind, id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()', [kind, id, JSON.stringify(payload)]);
    return payload;
  }

  async remove(kind: string, id: string): Promise<void> {
    await this.db.query('DELETE FROM sdlearn_records WHERE kind = $1 AND id = $2', [kind, id]);
  }

  /** Removes a session together with the chaos runs and evaluations that belong to it. */
  async removeSession(id: string): Promise<void> {
    await this.db.query("DELETE FROM sdlearn_records WHERE (kind = 'session' AND id = $1) OR (kind IN ('chaos-run', 'evaluation') AND payload->>'sessionId' = $1)", [id]);
  }
}
