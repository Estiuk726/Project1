// Test doubles for the domain ports. Import from '@flightmates/domain/testing' in tests only.
import type { Analytics, AnalyticsEvent } from '../ports/analytics';
import type {
  AccessTokenCheck,
  AuthProvider,
  AuthSession,
  RefreshResult,
  ResendEmailCodeResult,
  SignInResult,
  SignUpResult,
  VerifyEmailCodeResult,
} from '../ports/auth-provider';
import type { Clock } from '../ports/clock';
import type { ErrorContext, ErrorTracker } from '../ports/error-tracker';
import type { LogFields, Logger, LogLevel } from '../ports/logger';
import type {
  AccountView,
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

export interface LogEntry {
  level: LogLevel;
  event: string;
  fields: LogFields;
}

/** Keeps log calls in memory. Does not redact: use the JSON logger to test redaction. */
export class RecordingLogger implements Logger {
  readonly entries: LogEntry[] = [];
  debug(event: string, fields: LogFields = {}): void {
    this.entries.push({ level: 'debug', event, fields });
  }
  info(event: string, fields: LogFields = {}): void {
    this.entries.push({ level: 'info', event, fields });
  }
  warn(event: string, fields: LogFields = {}): void {
    this.entries.push({ level: 'warn', event, fields });
  }
  error(event: string, fields: LogFields = {}): void {
    this.entries.push({ level: 'error', event, fields });
  }
}

export class RecordingErrorTracker implements ErrorTracker {
  readonly captured: { error: unknown; context: ErrorContext }[] = [];
  flushes = 0;
  capture(error: unknown, context: ErrorContext): void {
    this.captured.push({ error, context });
  }
  flush(): Promise<void> {
    this.flushes += 1;
    return Promise.resolve();
  }
}

interface FakeAuthAccount {
  id: string;
  email: string;
  password: string;
  verified: boolean;
  code: string;
}

interface FakeSession {
  id: string;
  providerUserId: string;
  accessToken: string;
  refreshToken: string;
  accessExpired: boolean;
  revoked: boolean;
}

/**
 * In-memory AuthProvider. Every issued verification code is '123456'.
 * Sessions can be expired (`expireAccessTokens`) and revoked (`signOut`), like the real one:
 * a revoked session can no longer refresh, and its access token stops working once expired.
 */
export class FakeAuthProvider implements AuthProvider {
  static readonly CODE = '123456';
  readonly accounts = new Map<string, FakeAuthAccount>();
  readonly sessions: FakeSession[] = [];
  readonly deletedIds: string[] = [];
  readonly sentCodes: string[] = [];
  rateLimited = false;
  private nextId = 1;
  private nextToken = 1;

  /** Use a distinct prefix per test when several fakes share one database. */
  constructor(private readonly idPrefix = 'auth-') {}

  signUpWithPassword(input: { email: string; password: string }): Promise<SignUpResult> {
    if (this.rateLimited) return Promise.resolve({ status: 'rate_limited' });
    const existing = this.accounts.get(input.email);
    if (existing?.verified) return Promise.resolve({ status: 'already_registered' });
    const account = existing ?? {
      id: `${this.idPrefix}${String(this.nextId++)}`,
      email: input.email,
      password: input.password,
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
    return Promise.resolve({ status: 'verified', session: this.startSession(account.id) });
  }

  resendEmailCode(input: { email: string }): Promise<ResendEmailCodeResult> {
    if (this.rateLimited) return Promise.resolve({ status: 'rate_limited' });
    if (this.accounts.has(input.email)) this.sentCodes.push(input.email);
    return Promise.resolve({ status: 'sent' });
  }

  signInWithPassword(input: { email: string; password: string }): Promise<SignInResult> {
    if (this.rateLimited) return Promise.resolve({ status: 'rate_limited' });
    const account = this.accounts.get(input.email);
    if (!account || account.password !== input.password) {
      return Promise.resolve({ status: 'invalid_credentials' });
    }
    if (!account.verified) return Promise.resolve({ status: 'email_not_verified' });
    return Promise.resolve({ status: 'signed_in', session: this.startSession(account.id) });
  }

  checkAccessToken(accessToken: string): Promise<AccessTokenCheck> {
    const session = this.sessions.find((s) => s.accessToken === accessToken);
    if (!session || session.accessExpired) return Promise.resolve({ status: 'invalid' });
    return Promise.resolve({ status: 'valid', providerUserId: session.providerUserId });
  }

  refreshSession(refreshToken: string): Promise<RefreshResult> {
    const session = this.sessions.find((s) => s.refreshToken === refreshToken);
    if (!session || session.revoked) return Promise.resolve({ status: 'invalid' });
    // Refresh tokens are single use: rotate both tokens.
    session.accessToken = this.token('at');
    session.refreshToken = this.token('rt');
    session.accessExpired = false;
    return Promise.resolve({ status: 'refreshed', session: this.toAuthSession(session) });
  }

  signOut(accessToken: string, scope: 'this_device' | 'other_devices'): Promise<void> {
    const current = this.sessions.find((s) => s.accessToken === accessToken);
    if (!current) return Promise.resolve();
    for (const session of this.sessions) {
      if (session.providerUserId !== current.providerUserId) continue;
      const isCurrent = session === current;
      if (scope === 'this_device' ? isCurrent : !isCurrent) {
        session.revoked = true;
        // Signing out this device ends its access token at once.
        if (scope === 'this_device') session.accessExpired = true;
      }
    }
    return Promise.resolve();
  }

  deleteUser(providerUserId: string): Promise<void> {
    this.deletedIds.push(providerUserId);
    for (const [email, account] of this.accounts) {
      if (account.id === providerUserId) this.accounts.delete(email);
    }
    return Promise.resolve();
  }

  /** Simulates time passing beyond the access token lifetime. */
  expireAccessTokens(): void {
    for (const session of this.sessions) session.accessExpired = true;
  }

  private startSession(providerUserId: string): AuthSession {
    const session: FakeSession = {
      id: `session-${String(this.sessions.length + 1)}`,
      providerUserId,
      accessToken: this.token('at'),
      refreshToken: this.token('rt'),
      accessExpired: false,
      revoked: false,
    };
    this.sessions.push(session);
    return this.toAuthSession(session);
  }

  private toAuthSession(session: FakeSession): AuthSession {
    return {
      providerUserId: session.providerUserId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: new Date('2026-09-28T11:00:00Z'),
    };
  }

  private token(kind: string): string {
    return `${kind}-${this.idPrefix}${String(this.nextToken++)}`;
  }
}

interface StoredUser extends NewUserWithProfile {
  id: string;
  emailVerifiedAt: Date | null;
  deleted: boolean;
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
    // Valid UUIDs, like the database.
    const id = `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`;
    this.users.push({ ...user, id, emailVerifiedAt: null, deleted: false });
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

  getAccountView(authProviderId: string): Promise<AccountView | null> {
    const user = this.users.find((u) => u.authProviderId === authProviderId && !u.deleted);
    if (!user) return Promise.resolve(null);
    return Promise.resolve({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      status: 'active',
      profile: {
        displayName: user.displayName,
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
  }
}
