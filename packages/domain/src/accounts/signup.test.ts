import { beforeEach, describe, expect, it } from 'vitest';
import {
  FakeAuthProvider,
  InMemoryUserRepository,
  RecordingAnalytics,
  fixedClock,
} from '../testing';
import { DomainError } from './errors';
import {
  isEmailVerified,
  resendVerificationCode,
  signUp,
  verifyEmail,
  type AccountDeps,
} from './signup';

const adult = {
  firstName: 'Tahmid',
  email: 'tahmid@example.com',
  password: 'correct horse battery',
  dateOfBirth: '2002-03-12',
};

describe('account signup and verification', () => {
  let authProvider: FakeAuthProvider;
  let users: InMemoryUserRepository;
  let analytics: RecordingAnalytics;
  let deps: AccountDeps;

  beforeEach(() => {
    authProvider = new FakeAuthProvider();
    users = new InMemoryUserRepository();
    analytics = new RecordingAnalytics();
    deps = { authProvider, users, analytics, clock: fixedClock('2026-09-28T10:00:00Z') };
  });

  async function expectDomainError(promise: Promise<unknown>, code: string) {
    await expect(promise).rejects.toBeInstanceOf(DomainError);
    await expect(promise).rejects.toMatchObject({ code });
  }

  it('creates the login account, user and profile, unverified', async () => {
    await expect(signUp(deps, adult)).resolves.toEqual({ status: 'verification_pending' });

    expect(users.users).toHaveLength(1);
    const [user] = users.users;
    expect(user).toMatchObject({
      email: adult.email,
      displayName: 'Tahmid',
      dateOfBirth: '2002-03-12',
    });
    expect(user?.emailVerifiedAt).toBeNull();
    expect(isEmailVerified({ emailVerifiedAt: user?.emailVerifiedAt ?? null })).toBe(false);
    expect(authProvider.sentCodes).toEqual([adult.email]);
    expect(analytics.events).toEqual([{ name: 'signup_completed', userId: user?.id }]);
  });

  it('rejects under-18s without creating a login account or user', async () => {
    await expectDomainError(signUp(deps, { ...adult, dateOfBirth: '2008-09-29' }), 'UNDERAGE');
    expect(authProvider.accounts.size).toBe(0);
    expect(users.users).toHaveLength(0);
    expect(analytics.events).toEqual([]);
  });

  it('accepts someone whose 18th birthday is today', async () => {
    await expect(signUp(deps, { ...adult, dateOfBirth: '2008-09-28' })).resolves.toEqual({
      status: 'verification_pending',
    });
  });

  it('gives the same answer for an already registered, verified email (Q6)', async () => {
    await signUp(deps, adult);
    await verifyEmail(deps, { email: adult.email, code: FakeAuthProvider.CODE });

    await expect(signUp(deps, { ...adult, firstName: 'Other' })).resolves.toEqual({
      status: 'verification_pending',
    });
    expect(users.users).toHaveLength(1);
    expect(users.users[0]?.displayName).toBe('Tahmid');
  });

  it('does not duplicate the user when an unverified signup is repeated', async () => {
    await signUp(deps, adult);
    await signUp(deps, adult);
    expect(users.users).toHaveLength(1);
    expect(authProvider.sentCodes).toHaveLength(2);
  });

  it('deletes the login account when saving the user fails', async () => {
    users.failNextCreate = true;
    await expect(signUp(deps, adult)).rejects.toThrow('database unavailable');
    expect(authProvider.deletedIds).toEqual(['auth-1']);
    expect(authProvider.accounts.size).toBe(0);
    expect(users.users).toHaveLength(0);
  });

  it('deletes the new login account when the email already belongs to an app user', async () => {
    await users.createWithProfile({
      authProviderId: 'someone-else',
      email: adult.email,
      dateOfBirth: '1990-01-01',
      displayName: 'Existing',
    });
    await expect(signUp(deps, adult)).resolves.toEqual({ status: 'verification_pending' });
    expect(authProvider.deletedIds).toEqual(['auth-1']);
    expect(users.users).toHaveLength(1);
  });

  it('reports rate limiting from the provider', async () => {
    authProvider.rateLimited = true;
    await expectDomainError(signUp(deps, adult), 'RATE_LIMITED');
    await expectDomainError(resendVerificationCode(deps, { email: adult.email }), 'RATE_LIMITED');
  });

  it('marks the user verified with the correct code', async () => {
    await signUp(deps, adult);
    await expect(
      verifyEmail(deps, { email: adult.email, code: FakeAuthProvider.CODE }),
    ).resolves.toEqual({ status: 'verified' });

    expect(users.users[0]?.emailVerifiedAt).toEqual(new Date('2026-09-28T10:00:00Z'));
    expect(analytics.events.map((e) => e.name)).toEqual(['signup_completed', 'email_verified']);
  });

  it('rejects a wrong code and leaves the user unverified', async () => {
    await signUp(deps, adult);
    await expectDomainError(
      verifyEmail(deps, { email: adult.email, code: '000000' }),
      'INVALID_CODE',
    );
    expect(users.users[0]?.emailVerifiedAt).toBeNull();
  });

  it('keeps the first verification time and event when verified twice', async () => {
    await signUp(deps, adult);
    await verifyEmail(deps, { email: adult.email, code: FakeAuthProvider.CODE });
    deps = { ...deps, clock: fixedClock('2026-09-29T10:00:00Z') };
    await verifyEmail(deps, { email: adult.email, code: FakeAuthProvider.CODE });

    expect(users.users[0]?.emailVerifiedAt).toEqual(new Date('2026-09-28T10:00:00Z'));
    expect(analytics.events.filter((e) => e.name === 'email_verified')).toHaveLength(1);
  });

  it('treats a verified login account without an app user as an invalid code', async () => {
    await authProvider.signUpWithPassword({ email: adult.email, password: adult.password });
    await expectDomainError(
      verifyEmail(deps, { email: adult.email, code: FakeAuthProvider.CODE }),
      'INVALID_CODE',
    );
  });

  it('resends a code with the same answer for unknown emails (Q6)', async () => {
    await expect(resendVerificationCode(deps, { email: 'nobody@example.com' })).resolves.toEqual({
      status: 'code_sent',
    });
  });
});
