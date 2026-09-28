import type { Analytics } from '../ports/analytics';
import type { AuthProvider } from '../ports/auth-provider';
import type { Clock } from '../ports/clock';
import type { UserAccount, UserRepository } from '../ports/user-repository';
import { isAdult } from './age';
import { DomainError } from './errors';

export interface AccountDeps {
  authProvider: AuthProvider;
  users: UserRepository;
  clock: Clock;
  analytics: Analytics;
}

export interface SignUpInput {
  firstName: string;
  email: string;
  password: string;
  dateOfBirth: string;
}

/**
 * PRD 9.1. Rejects under-18s before any account exists, creates the login account,
 * then the user and profile rows. Returns the same result whether or not the email
 * was already registered, so the API cannot be used to find accounts (Q6).
 */
export async function signUp(
  deps: AccountDeps,
  input: SignUpInput,
): Promise<{ status: 'verification_pending' }> {
  if (!isAdult(input.dateOfBirth, deps.clock.today())) {
    throw new DomainError('UNDERAGE', 'You must be 18 or older to use FlightMates.');
  }

  const signUpResult = await deps.authProvider.signUpWithPassword({
    email: input.email,
    password: input.password,
  });
  if (signUpResult.status === 'rate_limited') {
    throw new DomainError('RATE_LIMITED', 'Too many attempts. Try again later.');
  }
  if (signUpResult.status === 'already_registered') {
    return { status: 'verification_pending' };
  }

  const { providerUserId } = signUpResult;

  // The provider returns the same id when an unverified signup is repeated.
  if (await deps.users.findByAuthProviderId(providerUserId)) {
    return { status: 'verification_pending' };
  }

  let created;
  try {
    created = await deps.users.createWithProfile({
      authProviderId: providerUserId,
      email: input.email,
      dateOfBirth: input.dateOfBirth,
      displayName: input.firstName,
    });
  } catch (error) {
    await deps.authProvider.deleteUser(providerUserId);
    throw error;
  }

  if (created.status === 'conflict') {
    // A concurrent request for the same login account already saved it: nothing to undo.
    // An email conflict means this login account has no app user and must not linger.
    if (created.on === 'email') await deps.authProvider.deleteUser(providerUserId);
    return { status: 'verification_pending' };
  }

  await deps.analytics.track({ name: 'signup_completed', userId: created.userId });
  return { status: 'verification_pending' };
}

/** Confirms the 6-digit code and marks the user verified (PRD 9.1, 10.1). */
export async function verifyEmail(
  deps: AccountDeps,
  input: { email: string; code: string },
): Promise<{ status: 'verified' }> {
  const result = await deps.authProvider.verifyEmailCode(input);
  if (result.status === 'invalid_code') {
    throw new DomainError('INVALID_CODE', 'That code is wrong or has expired.');
  }

  const account = await deps.users.findByAuthProviderId(result.providerUserId);
  if (!account) {
    // No app user for this login account (an undone signup). Same answer as a bad code.
    throw new DomainError('INVALID_CODE', 'That code is wrong or has expired.');
  }

  if (!account.emailVerifiedAt) {
    await deps.users.markEmailVerified(result.providerUserId, deps.clock.now());
    await deps.analytics.track({ name: 'email_verified', userId: account.id });
  }
  return { status: 'verified' };
}

/** Sends a new code. Same response whether or not the email is registered (Q6). */
export async function resendVerificationCode(
  deps: Pick<AccountDeps, 'authProvider'>,
  input: { email: string },
): Promise<{ status: 'code_sent' }> {
  const result = await deps.authProvider.resendEmailCode(input);
  if (result.status === 'rate_limited') {
    throw new DomainError('RATE_LIMITED', 'Too many attempts. Try again later.');
  }
  return { status: 'code_sent' };
}

/** PRD 9.1: only verified users appear in discovery or send requests. */
export function isEmailVerified(account: Pick<UserAccount, 'emailVerifiedAt'>): boolean {
  return account.emailVerifiedAt !== null;
}
