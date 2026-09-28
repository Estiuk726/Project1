import type { AuthSession } from '../ports/auth-provider';
import type { AccountView } from '../ports/user-repository';
import { DomainError } from './errors';
import type { AccountDeps } from './signup';

type SessionDeps = Pick<AccountDeps, 'authProvider' | 'users'>;

const invalidCredentials = () =>
  new DomainError('INVALID_CREDENTIALS', 'That email and password do not match.');
const unauthenticated = () => new DomainError('UNAUTHENTICATED', 'Please log in.');

/** PRD 9.1: email and password login. Wrong email and wrong password look the same. */
export async function signIn(
  deps: SessionDeps,
  input: { email: string; password: string },
): Promise<{ status: 'signed_in'; session: AuthSession }> {
  const result = await deps.authProvider.signInWithPassword(input);
  switch (result.status) {
    case 'invalid_credentials':
      throw invalidCredentials();
    case 'rate_limited':
      throw new DomainError('RATE_LIMITED', 'Too many attempts. Try again later.');
    case 'email_not_verified':
      throw new DomainError('EMAIL_NOT_VERIFIED', 'Confirm your email with the code we sent.');
    case 'signed_in':
      break;
  }

  // A login account without a live app user (undone signup, deleted account) cannot sign in.
  if (!(await deps.users.getAccountView(result.session.providerUserId))) {
    await deps.authProvider.signOut(result.session.accessToken, 'this_device');
    throw invalidCredentials();
  }
  return { status: 'signed_in', session: result.session };
}

export interface Authenticated {
  account: AccountView;
  accessToken: string;
  /** Set when the access token was refreshed; the caller must store the new tokens. */
  refreshedSession?: AuthSession;
}

/**
 * Resolves the signed-in user from the session tokens, refreshing an expired access token.
 * Throws UNAUTHENTICATED when there is no usable session or the user no longer exists.
 */
export async function authenticate(
  deps: SessionDeps,
  tokens: { accessToken?: string | undefined; refreshToken?: string | undefined },
): Promise<Authenticated> {
  if (tokens.accessToken) {
    const check = await deps.authProvider.checkAccessToken(tokens.accessToken);
    if (check.status === 'valid') {
      const account = await deps.users.getAccountView(check.providerUserId);
      if (!account) throw unauthenticated();
      return { account, accessToken: tokens.accessToken };
    }
  }

  if (tokens.refreshToken) {
    const refreshed = await deps.authProvider.refreshSession(tokens.refreshToken);
    if (refreshed.status === 'refreshed') {
      const account = await deps.users.getAccountView(refreshed.session.providerUserId);
      if (!account) throw unauthenticated();
      return {
        account,
        accessToken: refreshed.session.accessToken,
        refreshedSession: refreshed.session,
      };
    }
  }

  throw unauthenticated();
}

/** Ends this device's session. Safe to call with a missing or expired token. */
export async function signOut(
  deps: Pick<AccountDeps, 'authProvider'>,
  accessToken: string | undefined,
): Promise<void> {
  if (!accessToken) return;
  if ((await deps.authProvider.checkAccessToken(accessToken)).status !== 'valid') return;
  await deps.authProvider.signOut(accessToken, 'this_device');
}

/** PRD 9.1 "log out other devices": other sessions can no longer refresh. */
export async function signOutOtherDevices(
  deps: Pick<AccountDeps, 'authProvider'>,
  authenticated: Pick<Authenticated, 'accessToken'>,
): Promise<void> {
  await deps.authProvider.signOut(authenticated.accessToken, 'other_devices');
}
