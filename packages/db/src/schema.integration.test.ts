import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { userProfiles, users } from './schema';
import { createTestDatabase, testDatabaseUrl } from './testing/test-database';

const serverUrl = testDatabaseUrl();

describe.skipIf(!serverUrl)('database schema (integration)', () => {
  let t: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    t = await createTestDatabase(serverUrl ?? '');
  });

  afterAll(async () => {
    await t.drop();
  });

  let counter = 0;
  async function insertUser(email = `user${String(++counter)}@example.com`) {
    const [row] = await t.db
      .insert(users)
      .values({ authProviderId: `auth-${String(++counter)}`, email, dateOfBirth: '2002-03-12' })
      .returning();
    if (!row) throw new Error('insert returned no row');
    return row;
  }

  it('applies migrations to a clean database and re-running them is a no-op', async () => {
    await t.runMigrations();
    const [applied] = await t.sql<{ count: number }[]>`
      select count(*)::int as count from drizzle.__drizzle_migrations`;
    expect(applied?.count).toBe(2);
  });

  it('has row level security enabled on every public table', async () => {
    const withoutRls = await t.sql<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public' and not rowsecurity`;
    expect(withoutRls).toEqual([]);
  });

  it('applies the documented defaults to a new user and profile', async () => {
    const user = await insertUser();
    expect(user.status).toBe('active');
    expect(user.role).toBe('user');
    expect(user.emailVerifiedAt).toBeNull();

    const [profile] = await t.db
      .insert(userProfiles)
      .values({ userId: user.id, displayName: 'Tahmid' })
      .returning();
    expect(profile).toMatchObject({
      languages: [],
      interests: [],
      showAge: false,
      showUniversity: false,
      requestPolicy: 'everyone',
      homeCountry: null,
    });
  });

  it('rejects the same email in a different case', async () => {
    await insertUser('Case@Example.com');
    await expect(
      t.sql`insert into users (auth_provider_id, email, date_of_birth)
            values ('auth-case-2', 'case@example.COM', '2000-01-01')`,
    ).rejects.toMatchObject({ code: '23505', constraint_name: 'users_email_lower_key' });
  });

  it('rejects a duplicate auth provider id', async () => {
    const user = await insertUser();
    await expect(
      t.sql`insert into users (auth_provider_id, email, date_of_birth)
            values (${user.authProviderId}, 'other@example.com', '2000-01-01')`,
    ).rejects.toMatchObject({ code: '23505', constraint_name: 'users_auth_provider_id_key' });
  });

  it.each([
    ['empty display name', { display_name: '' }, 'user_profiles_display_name_length'],
    [
      '51-character display name',
      { display_name: 'x'.repeat(51) },
      'user_profiles_display_name_length',
    ],
    ['301-character bio', { bio: 'x'.repeat(301) }, 'user_profiles_bio_length'],
    ['6 interests', { interests: ['a', 'b', 'c', 'd', 'e', 'f'] }, 'user_profiles_interests_max'],
    ['lowercase country code', { home_country: 'bd' }, 'user_profiles_home_country_format'],
  ])('rejects a profile with %s', async (_label, overrides, constraint) => {
    const user = await insertUser();
    const row = { user_id: user.id, display_name: 'Tahmid', ...overrides };
    await expect(t.sql`insert into user_profiles ${t.sql(row)}`).rejects.toMatchObject({
      code: '23514',
      constraint_name: constraint,
    });
  });

  it('accepts a profile at the documented limits', async () => {
    const user = await insertUser();
    await t.db.insert(userProfiles).values({
      userId: user.id,
      displayName: 'x'.repeat(50),
      bio: 'x'.repeat(300),
      interests: ['a', 'b', 'c', 'd', 'e'],
      homeCountry: 'BD',
      languages: ['bn', 'en'],
    });
  });

  it('deletes the profile when the user is deleted', async () => {
    const user = await insertUser();
    await t.db.insert(userProfiles).values({ userId: user.id, displayName: 'Sadia' });
    await t.db.delete(users).where(eq(users.id, user.id));
    const remaining = await t.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id));
    expect(remaining).toEqual([]);
  });

  it('updates updated_at on every update', async () => {
    const user = await insertUser();
    await t.sql`update users set updated_at = now() - interval '1 day' where id = ${user.id}`;
    // The trigger overrides the value set above, so updated_at ends up at the current time.
    const [row] = await t.sql<{ fresh: boolean }[]>`
      select updated_at > now() - interval '1 minute' as fresh from users where id = ${user.id}`;
    expect(row?.fresh).toBe(true);
  });
});
