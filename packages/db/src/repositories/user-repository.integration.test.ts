import { signUp, verifyEmail, type AccountDeps } from '@flightmates/domain';
import { FakeAuthProvider, RecordingAnalytics, fixedClock } from '@flightmates/domain/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { userProfiles, users } from '../schema';
import { createTestDatabase, testDatabaseUrl } from '../testing/test-database';
import { createUserRepository } from './user-repository';

const serverUrl = testDatabaseUrl();

describe.skipIf(!serverUrl)('user repository and signup (integration)', () => {
  let t: Awaited<ReturnType<typeof createTestDatabase>>;
  let deps: AccountDeps;
  let authProvider: FakeAuthProvider;

  beforeAll(async () => {
    t = await createTestDatabase(serverUrl ?? '');
  });

  afterAll(async () => {
    await t.drop();
  });

  let fakeCount = 0;
  function freshDeps() {
    authProvider = new FakeAuthProvider(`int-${String(++fakeCount)}-`);
    deps = {
      authProvider,
      users: createUserRepository(t.db),
      analytics: new RecordingAnalytics(),
      clock: fixedClock('2026-09-28T10:00:00Z'),
    };
  }

  it('signup stores the user and profile together, unverified', async () => {
    freshDeps();
    await signUp(deps, {
      firstName: 'Sadia',
      email: 'sadia@example.com',
      password: 'correct horse battery',
      dateOfBirth: '2003-05-01',
    });

    const [user] = await t.db.select().from(users).where(eq(users.email, 'sadia@example.com'));
    expect(user).toMatchObject({
      dateOfBirth: '2003-05-01',
      emailVerifiedAt: null,
      status: 'active',
    });
    const [profile] = await t.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user?.id ?? ''));
    expect(profile?.displayName).toBe('Sadia');
  });

  it('verifying the code sets email_verified_at once', async () => {
    freshDeps();
    await signUp(deps, {
      firstName: 'Aarav',
      email: 'aarav@example.com',
      password: 'correct horse battery',
      dateOfBirth: '2001-01-01',
    });
    await verifyEmail(deps, { email: 'aarav@example.com', code: FakeAuthProvider.CODE });
    await verifyEmail(
      { ...deps, clock: fixedClock('2026-10-01T00:00:00Z') },
      { email: 'aarav@example.com', code: FakeAuthProvider.CODE },
    );

    const [user] = await t.db.select().from(users).where(eq(users.email, 'aarav@example.com'));
    expect(user?.emailVerifiedAt).toEqual(new Date('2026-09-28T10:00:00Z'));
  });

  it('reports an email conflict case-insensitively and leaves no partial rows', async () => {
    freshDeps();
    const repo = createUserRepository(t.db);
    await repo.createWithProfile({
      authProviderId: 'a-1',
      email: 'bilal@example.com',
      dateOfBirth: '2000-01-01',
      displayName: 'Bilal',
    });
    const result = await repo.createWithProfile({
      authProviderId: 'a-2',
      email: 'BILAL@example.com',
      dateOfBirth: '2000-01-01',
      displayName: 'Other',
    });
    expect(result).toEqual({ status: 'conflict', on: 'email' });
    await expect(repo.findByAuthProviderId('a-2')).resolves.toBeNull();
  });

  it('reports an auth provider id conflict', async () => {
    const repo = createUserRepository(t.db);
    await repo.createWithProfile({
      authProviderId: 'dup-1',
      email: 'one@example.com',
      dateOfBirth: '2000-01-01',
      displayName: 'One',
    });
    await expect(
      repo.createWithProfile({
        authProviderId: 'dup-1',
        email: 'two@example.com',
        dateOfBirth: '2000-01-01',
        displayName: 'Two',
      }),
    ).resolves.toEqual({ status: 'conflict', on: 'auth_provider_id' });
  });

  it('rolls back the user row when the profile insert fails', async () => {
    const repo = createUserRepository(t.db);
    await expect(
      repo.createWithProfile({
        authProviderId: 'rollback-1',
        email: 'rollback@example.com',
        dateOfBirth: '2000-01-01',
        displayName: 'x'.repeat(51),
      }),
    ).rejects.toThrow();
    await expect(repo.findByAuthProviderId('rollback-1')).resolves.toBeNull();
  });

  it('returns null when marking an unknown user verified', async () => {
    const repo = createUserRepository(t.db);
    await expect(repo.markEmailVerified('nobody', new Date())).resolves.toBeNull();
  });

  it('returns the account view only for live users', async () => {
    const repo = createUserRepository(t.db);
    await repo.createWithProfile({
      authProviderId: 'view-1',
      email: 'view@example.com',
      dateOfBirth: '2000-01-01',
      displayName: 'Viewer',
    });
    await expect(repo.getAccountView('view-1')).resolves.toEqual({
      id: expect.any(String) as unknown,
      email: 'view@example.com',
      emailVerified: false,
      status: 'active',
      profile: {
        displayName: 'Viewer',
        photoKey: null,
        homeCountry: null,
        bio: null,
        languages: [],
        interests: [],
        showAge: false,
        showUniversity: false,
        requestPolicy: 'everyone',
      },
    });

    await t.db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.authProviderId, 'view-1'));
    await expect(repo.getAccountView('view-1')).resolves.toBeNull();
    await expect(repo.getAccountView('nobody')).resolves.toBeNull();
  });

  it('never includes the date of birth in the account view', async () => {
    const repo = createUserRepository(t.db);
    await repo.createWithProfile({
      authProviderId: 'view-2',
      email: 'view2@example.com',
      dateOfBirth: '1999-12-31',
      displayName: 'Viewer',
    });
    const view = await repo.getAccountView('view-2');
    expect(JSON.stringify(view)).not.toContain('1999-12-31');
  });
});
