import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = ReturnType<typeof createDatabase>['db'];

/**
 * Creates a Drizzle client. Use the Supabase transaction pooler URL (port 6543) in the app;
 * prepared statements are off because the pooler does not support them (ADR 0002).
 */
export function createDatabase(databaseUrl: string) {
  const sqlClient = postgres(databaseUrl, { prepare: false });
  const db = drizzle(sqlClient, { schema });
  return { db, close: () => sqlClient.end() };
}
