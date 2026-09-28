import {
  FakeAuthProvider,
  InMemoryUserRepository,
  RecordingAnalytics,
  RecordingErrorTracker,
  RecordingLogger,
  fixedClock,
} from '@flightmates/domain/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RouteDeps } from '../http';
import { handleResendCode, handleSignup, handleVerifyEmail } from './auth';

function post(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function read(response: Response) {
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const signup = {
  firstName: 'Tahmid',
  email: 'tahmid@example.com',
  password: 'correct horse battery',
  dateOfBirth: '2002-03-12',
};

describe('auth API handlers', () => {
  let deps: RouteDeps;
  let authProvider: FakeAuthProvider;
  let users: InMemoryUserRepository;

  beforeEach(() => {
    authProvider = new FakeAuthProvider();
    users = new InMemoryUserRepository();
    deps = {
      authProvider,
      users,
      analytics: new RecordingAnalytics(),
      clock: fixedClock('2026-09-28T10:00:00Z'),
      logger: new RecordingLogger(),
      errorTracker: new RecordingErrorTracker(),
    };
  });

  it('signup returns 202 verification_pending', async () => {
    const res = await read(await handleSignup(post(signup), deps));
    expect(res).toEqual({ status: 202, body: { status: 'verification_pending' } });
    expect(users.users).toHaveLength(1);
  });

  it('signup rejects under-18s with 422 UNDERAGE and creates nothing', async () => {
    const res = await read(
      await handleSignup(post({ ...signup, dateOfBirth: '2010-01-01' }), deps),
    );
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: { code: 'UNDERAGE', message: 'You must be 18 or older to use FlightMates.' },
    });
    expect(authProvider.accounts.size).toBe(0);
    expect(users.users).toHaveLength(0);
  });

  it('signup returns 400 INVALID_INPUT naming fields but not their values', async () => {
    const response = await handleSignup(
      post({ ...signup, email: 'secret-typo@@example', password: 'x' }),
      deps,
    );
    const text = await response.clone().text();
    const res = await read(response);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: 'INVALID_INPUT',
        details: expect.arrayContaining([
          expect.objectContaining({ path: 'email' }),
          expect.objectContaining({ path: 'password' }),
        ]) as unknown,
      },
    });
    expect(text).not.toContain('secret-typo');
  });

  it('signup rejects a body that is not JSON', async () => {
    const res = await read(await handleSignup(post('{not json'), deps));
    expect(res).toMatchObject({ status: 400, body: { error: { code: 'INVALID_INPUT' } } });
  });

  it('never returns the email or date of birth', async () => {
    const response = await handleSignup(post(signup), deps);
    const text = await response.text();
    expect(text).not.toContain(signup.email);
    expect(text).not.toContain(signup.dateOfBirth);
  });

  it('gives an already registered email the same 202 answer (Q6)', async () => {
    await handleSignup(post(signup), deps);
    await handleVerifyEmail(post({ email: signup.email, code: FakeAuthProvider.CODE }), deps);
    const res = await read(await handleSignup(post(signup), deps));
    expect(res).toEqual({ status: 202, body: { status: 'verification_pending' } });
  });

  it('verify-email returns 200 and marks the user verified', async () => {
    await handleSignup(post(signup), deps);
    const res = await read(
      await handleVerifyEmail(
        post({ email: 'Tahmid@Example.com', code: FakeAuthProvider.CODE }),
        deps,
      ),
    );
    expect(res).toEqual({ status: 200, body: { status: 'verified' } });
    expect(users.users[0]?.emailVerifiedAt).not.toBeNull();
    expect(authProvider.sessions).toHaveLength(1);
  });

  it('verify-email returns 400 INVALID_CODE for a wrong code', async () => {
    await handleSignup(post(signup), deps);
    const res = await read(
      await handleVerifyEmail(post({ email: signup.email, code: '999999' }), deps),
    );
    expect(res).toMatchObject({ status: 400, body: { error: { code: 'INVALID_CODE' } } });
    expect(users.users[0]?.emailVerifiedAt).toBeNull();
  });

  it('verify-email validates the code format', async () => {
    const res = await read(
      await handleVerifyEmail(post({ email: signup.email, code: '12ab' }), deps),
    );
    expect(res).toMatchObject({ status: 400, body: { error: { code: 'INVALID_INPUT' } } });
  });

  it('resend-code returns 202 for any valid email and 429 when rate limited', async () => {
    const ok = await read(await handleResendCode(post({ email: 'nobody@example.com' }), deps));
    expect(ok).toEqual({ status: 202, body: { status: 'code_sent' } });

    authProvider.rateLimited = true;
    const limited = await read(await handleResendCode(post({ email: 'nobody@example.com' }), deps));
    expect(limited).toMatchObject({ status: 429, body: { error: { code: 'RATE_LIMITED' } } });
  });

  it('returns 500 INTERNAL without internal details on unexpected errors', async () => {
    users.failNextCreate = true;
    const response = await handleSignup(post(signup), deps);
    const text = await response.clone().text();
    expect(await read(response)).toMatchObject({
      status: 500,
      body: { error: { code: 'INTERNAL' } },
    });
    expect(text).not.toContain('database unavailable');

    const requestId = response.headers.get('x-request-id');
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    const tracker = deps.errorTracker as RecordingErrorTracker;
    expect(tracker.captured).toHaveLength(1);
    expect(tracker.captured[0]?.context).toEqual({
      requestId,
      method: 'POST',
      route: '/api/v1/auth',
    });
  });

  it('logs every request with its id, route, status and domain error code', async () => {
    const response = await handleSignup(post({ ...signup, dateOfBirth: '2010-01-01' }), deps);
    const logger = deps.logger as RecordingLogger;
    expect(logger.entries).toEqual([
      {
        level: 'info',
        event: 'request.completed',
        fields: {
          requestId: response.headers.get('x-request-id'),
          method: 'POST',
          route: '/api/v1/auth',
          status: 422,
          errorCode: 'UNDERAGE',
          durationMs: expect.any(Number) as number,
        },
      },
    ]);
  });
});
