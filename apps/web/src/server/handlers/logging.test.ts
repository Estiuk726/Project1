import { createJsonLogger } from '@flightmates/adapters';
import {
  FakeAuthProvider,
  InMemoryUserRepository,
  RecordingAnalytics,
  RecordingErrorTracker,
  fixedClock,
} from '@flightmates/domain/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteDeps } from '../http';
import { handleLogin, handleLogout, handleSignup, handleVerifyEmail } from './auth';
import { handleGetMe } from './me';

// F-06 acceptance: logs contain no email or message body. Runs the real JSON logger.
const BASE = 'https://flightmates.app';
const tahmid = {
  firstName: 'Tahmid',
  email: 'tahmid.rahman@example.com',
  password: 'correct horse battery',
  dateOfBirth: '2002-03-12',
};
const messageBody = 'See you at gate B7, I have the window seat 14C';

function request(path: string, body?: unknown, cookies = ''): Request {
  const headers = new Headers({ origin: BASE });
  if (cookies) headers.set('cookie', cookies);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new Request(`${BASE}${path}?email=${encodeURIComponent(tahmid.email)}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((header) => header.split(';')[0] ?? '')
    .join('; ');
}

describe('structured logs', () => {
  let lines: string[];
  let deps: RouteDeps;
  let users: InMemoryUserRepository;

  beforeEach(() => {
    lines = [];
    users = new InMemoryUserRepository();
    deps = {
      authProvider: new FakeAuthProvider(),
      users,
      analytics: new RecordingAnalytics(),
      clock: fixedClock('2026-09-28T10:00:00Z'),
      logger: createJsonLogger({ level: 'debug', write: (line) => lines.push(line) }),
      errorTracker: new RecordingErrorTracker(),
    };
  });

  it('contain no email, password, token, code or message body across the account flow', async () => {
    await handleSignup(request('/api/v1/auth/signup', tahmid), deps);
    await handleVerifyEmail(
      request('/api/v1/auth/verify-email', { email: tahmid.email, code: FakeAuthProvider.CODE }),
      deps,
    );
    const login = await handleLogin(
      request('/api/v1/auth/login', { email: tahmid.email, password: tahmid.password }),
      deps,
    );
    const cookies = cookiesFrom(login);
    await handleGetMe(request('/api/v1/me', undefined, cookies), deps);
    await handleLogout(request('/api/v1/auth/logout', {}, cookies), deps);

    // An unexpected failure whose error message and cause quote personal data.
    vi.spyOn(users, 'createWithProfile').mockRejectedValueOnce(
      new Error(`insert failed for ${tahmid.email}: "${messageBody}"`, {
        cause: new Error(`Key (email)=(${tahmid.email}) already exists`),
      }),
    );
    const failed = await handleSignup(
      request('/api/v1/auth/signup', { ...tahmid, email: 'second@example.com' }),
      deps,
    );
    expect(failed.status).toBe(500);

    const records = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(records.map((r) => r.event)).toEqual([
      'request.completed',
      'request.completed',
      'request.completed',
      'request.completed',
      'request.completed',
      'request.failed',
      'request.completed',
    ]);
    expect(records.find((r) => r.event === 'request.failed')).toMatchObject({
      level: 'error',
      requestId: failed.headers.get('x-request-id'),
      error: { name: 'Error', cause: { name: 'Error' } },
    });

    const all = lines.join('\n');
    const secrets = [
      tahmid.email,
      'second@example.com',
      tahmid.password,
      tahmid.dateOfBirth,
      FakeAuthProvider.CODE,
      messageBody,
      'gate B7',
      '14C',
      ...cookies.split('; ').map((pair) => decodeURIComponent(pair.split('=')[1] ?? '')),
    ];
    for (const secret of secrets) {
      expect(secret).not.toBe('');
      expect(all).not.toContain(secret);
    }
    expect(all).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });
});
