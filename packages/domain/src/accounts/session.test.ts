import { beforeEach, describe, expect, it } from 'vitest';
import {
  FakeAuthProvider,
  InMemoryUserRepository,
  RecordingAnalytics,
  fixedClock,
} from '../testing';
import { authenticate, signIn, signOut, signOutOtherDevices } from './session';
import { signUp, verifyEmail, type AccountDeps } from './signup';

const tahmid = {
  firstName: 'Tahmid',
  email: 'tahmid@example.com',
  password: 'correct horse battery',
  dateOfBirth: '2002-03-12',
};

describe('sessions', () => {
  let authProvider: FakeAuthProvider;
  let users: InMemoryUserRepository;
  let deps: AccountDeps;

  beforeEach(() => {
    authProvider = new FakeAuthProvider();
    users = new InMemoryUserRepository();
    deps = {
      authProvider,
      users,
      analytics: new RecordingAnalytics(),
      clock: fixedClock('2026-09-28T10:00:00Z'),
    };
  });

  async function registerVerified(person = tahmid) {
    await signUp(deps, person);
    return verifyEmail(deps, { email: person.email, code: FakeAuthProvider.CODE });
  }

  describe('signIn', () => {
    it('returns a session for a verified user with the right password', async () => {
      await registerVerified();
      const result = await signIn(deps, { email: tahmid.email, password: tahmid.password });
      expect(result.session.providerUserId).toBe('auth-1');
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      await registerVerified();
      const wrongPassword = signIn(deps, { email: tahmid.email, password: 'nope-nope' });
      const unknown = signIn(deps, { email: 'ghost@example.com', password: tahmid.password });
      await expect(wrongPassword).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      await expect(unknown).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('rejects an unverified email with EMAIL_NOT_VERIFIED', async () => {
      await signUp(deps, tahmid);
      await expect(
        signIn(deps, { email: tahmid.email, password: tahmid.password }),
      ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    });

    it('rejects a login account that has no app user and ends that session', async () => {
      await authProvider.signUpWithPassword({ email: tahmid.email, password: tahmid.password });
      await authProvider.verifyEmailCode({ email: tahmid.email, code: FakeAuthProvider.CODE });
      await expect(
        signIn(deps, { email: tahmid.email, password: tahmid.password }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(authProvider.sessions.at(-1)?.revoked).toBe(true);
    });

    it('reports rate limiting', async () => {
      authProvider.rateLimited = true;
      await expect(
        signIn(deps, { email: tahmid.email, password: tahmid.password }),
      ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    });
  });

  describe('authenticate', () => {
    it('resolves the account from a valid access token', async () => {
      const { session } = await registerVerified();
      const result = await authenticate(deps, { accessToken: session.accessToken });
      expect(result.account).toMatchObject({ email: tahmid.email, emailVerified: true });
      expect(result.refreshedSession).toBeUndefined();
    });

    it('refreshes an expired access token and returns the new tokens', async () => {
      const { session } = await registerVerified();
      authProvider.expireAccessTokens();
      const result = await authenticate(deps, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
      expect(result.refreshedSession?.accessToken).not.toBe(session.accessToken);
      expect(result.accessToken).toBe(result.refreshedSession?.accessToken);
    });

    it('rejects a missing session', async () => {
      await expect(authenticate(deps, {})).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('rejects an expired access token without a usable refresh token', async () => {
      const { session } = await registerVerified();
      authProvider.expireAccessTokens();
      await expect(
        authenticate(deps, { accessToken: session.accessToken, refreshToken: 'rt-forged' }),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('rejects a reused refresh token (tokens rotate)', async () => {
      const { session } = await registerVerified();
      await authenticate(deps, { refreshToken: session.refreshToken });
      await expect(
        authenticate(deps, { refreshToken: session.refreshToken }),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('rejects the session of a deleted user', async () => {
      const { session } = await registerVerified();
      const stored = users.users[0];
      if (stored) stored.deleted = true;
      await expect(authenticate(deps, { accessToken: session.accessToken })).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    });
  });

  describe('signing out', () => {
    it('signOut ends this device at once', async () => {
      const { session } = await registerVerified();
      await signOut(deps, session.accessToken);
      await expect(
        authenticate(deps, {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('signOut is a no-op without a valid token', async () => {
      await expect(signOut(deps, undefined)).resolves.toBeUndefined();
      await expect(signOut(deps, 'at-forged')).resolves.toBeUndefined();
    });

    it('signOutOtherDevices keeps this device and stops others once their token expires', async () => {
      await registerVerified();
      const phone = await signIn(deps, { email: tahmid.email, password: tahmid.password });
      const laptop = await signIn(deps, { email: tahmid.email, password: tahmid.password });

      await signOutOtherDevices(deps, { accessToken: laptop.session.accessToken });
      authProvider.expireAccessTokens();

      await expect(
        authenticate(deps, {
          accessToken: phone.session.accessToken,
          refreshToken: phone.session.refreshToken,
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      await expect(
        authenticate(deps, {
          accessToken: laptop.session.accessToken,
          refreshToken: laptop.session.refreshToken,
        }),
      ).resolves.toMatchObject({ account: { email: tahmid.email } });
    });

    it("does not affect another user's sessions", async () => {
      const sadia = { ...tahmid, firstName: 'Sadia', email: 'sadia@example.com' };
      const tahmidSession = (await registerVerified()).session;
      const sadiaSession = (await registerVerified(sadia)).session;

      await signOutOtherDevices(deps, { accessToken: tahmidSession.accessToken });
      await signOut(deps, tahmidSession.accessToken);
      authProvider.expireAccessTokens();

      await expect(
        authenticate(deps, {
          accessToken: sadiaSession.accessToken,
          refreshToken: sadiaSession.refreshToken,
        }),
      ).resolves.toMatchObject({ account: { email: sadia.email } });
    });
  });
});
