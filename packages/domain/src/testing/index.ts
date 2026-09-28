// Test doubles for the domain ports. Import from '@flightmates/domain/testing' in tests only.
import type { Analytics, AnalyticsEvent } from '../ports/analytics';
import type {
  AuthProvider,
  ResendEmailCodeResult,
  SignUpResult,
  VerifyEmailCodeResult,
} from '../ports/auth-provider';
import type { Clock } from '../ports/clock';
import type {
  CreateUserResult,
  NewUserWithProfile,
  UserAccount,
  UserRepository,
} from '../ports/user-repository';

export function fixedClock(isoInstant: string): Clock {
  const now = new Date(isoInstant);
  return { now: () => now, today: () => now.toISOString().slice(0, 10) };
}

export class RecordingAnalytics implements Analytics {
  readonly events: AnalyticsEvent[] = [];
  track(event: AnalyticsEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

interface FakeAuthAccount {
  id: string;
  email: string;
  verified: boolean;
  code: string;
}

/** In-memory AuthProvider. Every issued verification code is '123456'. */
export class FakeAuthProvider implements AuthProvider {
  static readonly CODE = '123456';
  readonly accounts = new Map<string, FakeAuthAccount>();
  readonly deletedIds: string[] = [];
  readonly sentCodes: string[] = [];
  rateLimited = false;
  private nextId = 1;

  /** Use a distinct prefix per test when several fakes share one database. */
  constructor(private readonly idPrefix = 'auth-') {}

  signUpWithPassword(input: { email: string; password: string }): Promise<SignUpResult> {
    if (this.rateLimited) return Promise.resolve({ status: 'rate_limited' });
    const existing = this.accounts.get(input.email);
    if (existing?.verified) return Promise.resolve({ status: 'already_registered' });
    const account = existing ?? {
      id: `${this.idPrefix}${String(this.nextId++)}`,
      email: input.email,
      verified: false,
      code: FakeAuthProvider.CODE,
    };
    this.accounts.set(input.email, account);
    this.sentCodes.push(input.email);
    return Promise.resolve({ status: 'created', providerUserId: account.id });
  }

  verifyEmailCode(input: { email: string; code: string }): Promise<VerifyEmailCodeResult> {
    const account = this.accounts.get(input.email);
    if (!account || account.code !== input.code) {
      return Promise.resolve({ status: 'invalid_code' });
    }
    account.verified = true;
    return Promise.resolve({ status: 'verified', providerUserId: account.id });
  }

  resendEmailCode(input: { email: string }): Promise<ResendEmailCodeResult> {
    if (this.rateLimited) return Promise.resolve({ status: 'rate_limited' });
    if (this.accounts.has(input.email)) this.sentCodes.push(input.email);
    return Promise.resolve({ status: 'sent' });
  }

  deleteUser(providerUserId: string): Promise<void> {
    this.deletedIds.push(providerUserId);
    for (const [email, account] of this.accounts) {
      if (account.id === providerUserId) this.accounts.delete(email);
    }
    return Promise.resolve();
  }
}

interface StoredUser extends NewUserWithProfile {
  id: string;
  emailVerifiedAt: Date | null;
}

/** In-memory UserRepository with the same uniqueness rules as the database. */
export class InMemoryUserRepository implements UserRepository {
  readonly users: StoredUser[] = [];
  failNextCreate = false;
  private nextId = 1;

  createWithProfile(user: NewUserWithProfile): Promise<CreateUserResult> {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      return Promise.reject(new Error('database unavailable'));
    }
    if (this.users.some((u) => u.authProviderId === user.authProviderId)) {
      return Promise.resolve({ status: 'conflict', on: 'auth_provider_id' });
    }
    if (this.users.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
      return Promise.resolve({ status: 'conflict', on: 'email' });
    }
    const id = `user-${String(this.nextId++)}`;
    this.users.push({ ...user, id, emailVerifiedAt: null });
    return Promise.resolve({ status: 'created', userId: id });
  }

  findByAuthProviderId(authProviderId: string): Promise<UserAccount | null> {
    const user = this.users.find((u) => u.authProviderId === authProviderId);
    return Promise.resolve(user ? { id: user.id, emailVerifiedAt: user.emailVerifiedAt } : null);
  }

  markEmailVerified(authProviderId: string, at: Date): Promise<UserAccount | null> {
    const user = this.users.find((u) => u.authProviderId === authProviderId);
    if (!user) return Promise.resolve(null);
    user.emailVerifiedAt ??= at;
    return Promise.resolve({ id: user.id, emailVerifiedAt: user.emailVerifiedAt });
  }
}
