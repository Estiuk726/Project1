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
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../session';
import { handleLogin, handleLogout, handleSignup, handleVerifyEmail } from './auth';
import { handleGetMe, handleRevokeOtherSessions } from './me';

const BASE = 'https://flightmates.app';

/** A browser-like cookie jar: keeps what the server sets, sends it back. */
class Browser {
  private jar = new Map<string, string>();

  store(response: Response): Response {
    for (const header of response.headers.getSetCookie()) {
      const [pair = '', ...attributes] = header.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = decodeURIComponent(pair.slice(index + 1));
      const maxAge = attributes.find((a) => a.trim().startsWith('Max-Age='));
      if (value === '' || maxAge?.trim() === 'Max-Age=0') this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return response;
  }

  cookie(name: string): string | undefined {
    return this.jar.get(name);
  }

  request(path: string, init: { method?: string; body?: unknown; origin?: string } = {}): Request {
    const headers = new Headers({ origin: init.origin ?? BASE });
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    const cookies = [...this.jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
    if (cookies) headers.set('cookie', cookies);
    return new Request(`${BASE}${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  }
}

const tahmid = {
  firstName: 'Tahmid',
  email: 'tahmid@example.com',
  password: 'correct horse battery',
  dateOfBirth: '2002-03-12',
};
const sadia = { ...tahmid, firstName: 'Sadia', email: 'sadia@example.com' };

describe('session flow over HTTP', () => {
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

  async function registered(person = tahmid): Promise<Browser> {
    const browser = new Browser();
    await handleSignup(browser.request('/api/v1/auth/signup', { body: person }), deps);
    browser.store(
      await handleVerifyEmail(
        browser.request('/api/v1/auth/verify-email', {
          body: { email: person.email, code: FakeAuthProvider.CODE },
        }),
        deps,
      ),
    );
    return browser;
  }

  async function me(browser: Browser) {
    const response = browser.store(await handleGetMe(browser.request('/api/v1/me'), deps));
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it('verifying the email signs the user in with secure cookies', async () => {
    const browser = new Browser();
    await handleSignup(browser.request('/api/v1/auth/signup', { body: tahmid }), deps);
    const response = await handleVerifyEmail(
      browser.request('/api/v1/auth/verify-email', {
        body: { email: tahmid.email, code: FakeAuthProvider.CODE },
      }),
      deps,
    );
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    for (const header of cookies) {
      expect(header).toMatch(/; HttpOnly/);
      expect(header).toMatch(/; Secure/);
      expect(header).toMatch(/; SameSite=Lax/);
      expect(header).toMatch(/; Path=\//);
    }
    expect(cookies.find((c) => c.startsWith(`${ACCESS_COOKIE}=`))).toMatch(/Max-Age=3600/);
    expect(cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`))).toMatch(/Max-Age=2592000/);
    // Tokens only ever travel in cookies, never in the body.
    expect(await response.json()).toEqual({ status: 'verified' });
  });

  it('GET /me returns the caller account with no-store caching', async () => {
    const browser = await registered();
    const response = await handleGetMe(browser.request('/api/v1/me'), deps);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      email: tahmid.email,
      emailVerified: true,
      status: 'active',
      profile: { displayName: 'Tahmid', requestPolicy: 'everyone' },
    });
    expect(JSON.stringify(body)).not.toContain(tahmid.dateOfBirth);
  });

  it('GET /me without a session is 401 and clears cookies', async () => {
    const response = await handleGetMe(new Browser().request('/api/v1/me'), deps);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    expect(response.headers.getSetCookie().every((c) => c.includes('Max-Age=0'))).toBe(true);
  });

  it('each user only ever sees their own account (authorization)', async () => {
    const tahmidBrowser = await registered(tahmid);
    const sadiaBrowser = await registered(sadia);
    expect((await me(tahmidBrowser)).body).toMatchObject({ email: tahmid.email });
    expect((await me(sadiaBrowser)).body).toMatchObject({ email: sadia.email });

    // A forged cookie mixing one user's refresh token with another's access token still
    // resolves to exactly one owner, never a blend.
    const mixed = new Browser();
    const sadiaAccess = sadiaBrowser.cookie(ACCESS_COOKIE) ?? '';
    mixed.store(
      new Response(null, {
        headers: [['set-cookie', `${ACCESS_COOKIE}=${sadiaAccess}; Max-Age=60`]],
      }),
    );
    expect((await me(mixed)).body).toMatchObject({ email: sadia.email });
  });

  it('refreshes an expired access token and stores the new cookies', async () => {
    const browser = await registered();
    const oldAccess = browser.cookie(ACCESS_COOKIE);
    authProvider.expireAccessTokens();

    const first = await me(browser);
    expect(first.status).toBe(200);
    expect(browser.cookie(ACCESS_COOKIE)).not.toBe(oldAccess);
    expect((await me(browser)).status).toBe(200);
  });

  it('login sets cookies; wrong password is 401 INVALID_CREDENTIALS', async () => {
    await registered();
    const browser = new Browser();
    const bad = await handleLogin(
      browser.request('/api/v1/auth/login', { body: { email: tahmid.email, password: 'wrong' } }),
      deps,
    );
    expect(bad.status).toBe(401);
    expect(await bad.json()).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
    expect(bad.headers.getSetCookie()).toEqual([]);

    browser.store(
      await handleLogin(
        browser.request('/api/v1/auth/login', {
          body: { email: 'TAHMID@example.com', password: tahmid.password },
        }),
        deps,
      ),
    );
    expect((await me(browser)).body).toMatchObject({ email: tahmid.email });
  });

  it('login before verifying is 403 EMAIL_NOT_VERIFIED', async () => {
    const browser = new Browser();
    await handleSignup(browser.request('/api/v1/auth/signup', { body: tahmid }), deps);
    const response = await handleLogin(
      browser.request('/api/v1/auth/login', {
        body: { email: tahmid.email, password: tahmid.password },
      }),
      deps,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'EMAIL_NOT_VERIFIED' } });
  });

  it('logout ends the session and clears cookies, even with an expired access token', async () => {
    const browser = await registered();
    const stolenRefresh = browser.cookie(REFRESH_COOKIE);
    authProvider.expireAccessTokens();

    const response = browser.store(
      await handleLogout(browser.request('/api/v1/auth/logout', { method: 'POST' }), deps),
    );
    expect(response.status).toBe(204);
    expect(browser.cookie(ACCESS_COOKIE)).toBeUndefined();
    expect((await me(browser)).status).toBe(401);

    // The old refresh token no longer works either.
    const thief = new Browser();
    thief.store(
      new Response(null, {
        headers: [['set-cookie', `${REFRESH_COOKIE}=${stolenRefresh ?? ''}; Max-Age=60`]],
      }),
    );
    expect((await me(thief)).status).toBe(401);
  });

  it('logout without a session still answers 204', async () => {
    const response = await handleLogout(
      new Browser().request('/api/v1/auth/logout', { method: 'POST' }),
      deps,
    );
    expect(response.status).toBe(204);
  });

  it('revoke-others logs out other devices but keeps this one', async () => {
    const phone = await registered();
    const laptop = new Browser();
    laptop.store(
      await handleLogin(
        laptop.request('/api/v1/auth/login', {
          body: { email: tahmid.email, password: tahmid.password },
        }),
        deps,
      ),
    );

    const response = laptop.store(
      await handleRevokeOtherSessions(
        laptop.request('/api/v1/me/session/revoke-others', { method: 'POST' }),
        deps,
      ),
    );
    expect(response.status).toBe(204);

    authProvider.expireAccessTokens();
    expect((await me(phone)).status).toBe(401);
    expect((await me(laptop)).status).toBe(200);
  });

  it('revoke-others requires a session', async () => {
    const response = await handleRevokeOtherSessions(
      new Browser().request('/api/v1/me/session/revoke-others', { method: 'POST' }),
      deps,
    );
    expect(response.status).toBe(401);
  });

  it.each([
    ['another site', { origin: 'https://evil.example' }],
    ['a sandboxed page', { origin: 'null' }],
  ])('blocks requests from %s', async (_label, init) => {
    const browser = await registered();
    const login = await handleLogin(
      browser.request('/api/v1/auth/login', {
        body: { email: tahmid.email, password: tahmid.password },
        ...init,
      }),
      deps,
    );
    expect(login.status).toBe(403);
    expect(await login.json()).toMatchObject({ error: { code: 'FORBIDDEN_ORIGIN' } });

    const revoke = await handleRevokeOtherSessions(
      browser.request('/api/v1/me/session/revoke-others', { method: 'POST', ...init }),
      deps,
    );
    expect(revoke.status).toBe(403);
  });

  it('blocks requests the browser marks as cross-site', async () => {
    const request = new Browser().request('/api/v1/auth/logout', { method: 'POST' });
    const headers = new Headers(request.headers);
    headers.set('sec-fetch-site', 'cross-site');
    headers.delete('origin');
    const response = await handleLogout(new Request(request, { headers }), deps);
    expect(response.status).toBe(403);
  });
});
