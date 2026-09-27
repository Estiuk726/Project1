import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../schema';

const migrationsFolder = new URL('../../migrations', import.meta.url).pathname;

/** DATABASE_URL for integration tests. In CI a missing URL is an error, never a skip. */
export function testDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url && process.env.CI) {
    throw new Error('DATABASE_URL must be set in CI so integration tests run.');
  }
  return url;
}

/**
 * Creates an empty, uniquely named database on the server in DATABASE_URL,
 * applies all migrations, and returns clients plus a drop function.
 */
export async function createTestDatabase(serverUrl: string) {
  const name = `fm_test_${randomUUID().replaceAll('-', '')}`;
  const admin = postgres(serverUrl, { max: 1, onnotice: () => undefined });
  await admin.unsafe(`CREATE DATABASE "${name}"`);

  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const sql = postgres(url.toString(), { max: 2, onnotice: () => undefined });
  const db = drizzle(sql, { schema });
  const runMigrations = () => migrate(db, { migrationsFolder });
  await runMigrations();

  return {
    sql,
    db,
    runMigrations,
    async drop() {
      await sql.end();
      await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    },
  };
}
