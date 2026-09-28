// Applies pending migrations from packages/db/migrations. Usage: pnpm db:migrate
// Needs DATABASE_URL: a direct or session-pooler connection, not the transaction pooler.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
try {
  await migrate(drizzle(client), {
    migrationsFolder: new URL('../migrations', import.meta.url).pathname,
  });
  console.log('Migrations applied.');
} finally {
  await client.end();
}
