import { describe, expect, it } from 'vitest';
import { createSupabaseAuthProvider } from './supabase-auth-provider';

interface Call {
  method: string;
  path: string;
  body: unknown;
  apikey: string | null;
  authorization: string | null;
}

/** Fake Supabase Auth (GoTrue) HTTP API. Routes map "METHOD /path" to [status, body]. */
function fakeSupabase(routes: Record<string, [number, unknown]>) {
  const calls: Call[] = [];
  const fetchFn: typeof fetch = (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const key = `${request.method} ${url.pathname}${url.search}`;
    const route = routes[key];
    return request.text().then((text) => {
      calls.push({
        method: request.method,
        path: url.pathname,
        body: text ? (JSON.parse(text) as unknown) : null,
        apikey: request.headers.get('apikey'),
        authorization: request.headers.get('authorization'),
      });
      if (!route) return new Response(`no route for ${key}`, { status: 599 });
      const [status, body] = route;
      if (status === 204) return new Response(null, { status });
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    });
  };
  const provider = createSupabaseAuthProvider({
    url: 'https://project.supabase.co',
    anonKey: 'anon-key',
    serviceRoleKey: 'service-role-key',
    fetch: fetchFn,
  });
  return { provider, calls };
}

const user = (identities: unknown[]) => ({
  id: 'b0b0b0b0-0000-4000-8000-000000000001',
  aud: 'authenticated',
  email: 'tahmid@example.com',
  identities,
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-28T10:00:00Z',
});

describe('Supabase auth provider', () => {
  it('signs up with the anon key and returns the new user id', async () => {
    const { provider, calls } = fakeSupabase({
      'POST /auth/v1/signup': [200, user([{ id: 'identity-1' }])],
    });
    await expect(
      provider.signUpWithPassword({ email: 'tahmid@example.com', password: 'secret-pass' }),
    ).resolves.toEqual({ status: 'created', providerUserId: user([]).id });
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/auth/v1/signup',
      apikey: 'anon-key',
      body: { email: 'tahmid@example.com', password: 'secret-pass' },
    });
  });

  it('maps a user without identities to already_registered', async () => {
    const { provider } = fakeSupabase({ 'POST /auth/v1/signup': [200, user([])] });
    await expect(
      provider.signUpWithPassword({ email: 'tahmid@example.com', password: 'secret-pass' }),
    ).resolves.toEqual({ status: 'already_registered' });
  });

  it('maps HTTP 429 to rate_limited on signup and resend', async () => {
    const limited: [number, unknown] = [
      429,
      { code: 429, error_code: 'over_email_send_rate_limit', msg: 'rate limit' },
    ];
    const { provider } = fakeSupabase({
      'POST /auth/v1/signup': limited,
      'POST /auth/v1/resend': limited,
    });
    await expect(
      provider.signUpWithPassword({ email: 'a@b.co', password: 'secret-pass' }),
    ).resolves.toEqual({ status: 'rate_limited' });
    await expect(provider.resendEmailCode({ email: 'a@b.co' })).resolves.toEqual({
      status: 'rate_limited',
    });
  });

  it('throws on unexpected signup errors', async () => {
    const { provider } = fakeSupabase({
      'POST /auth/v1/signup': [500, { code: 500, error_code: 'unexpected_failure', msg: 'boom' }],
    });
    await expect(
      provider.signUpWithPassword({ email: 'a@b.co', password: 'secret-pass' }),
    ).rejects.toThrow();
  });

  it('verifies the 6-digit code as an email OTP', async () => {
    const { provider, calls } = fakeSupabase({
      'POST /auth/v1/verify': [
        200,
        {
          access_token: 'at',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: 1790000000,
          refresh_token: 'rt',
          user: user([{ id: 'identity-1' }]),
        },
      ],
    });
    await expect(
      provider.verifyEmailCode({ email: 'tahmid@example.com', code: '123456' }),
    ).resolves.toEqual({
      status: 'verified',
      session: {
        providerUserId: user([]).id,
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: new Date(1790000000 * 1000),
      },
    });
    expect(calls[0]?.body).toMatchObject({
      email: 'tahmid@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('maps an expired or wrong code to invalid_code', async () => {
    const { provider } = fakeSupabase({
      'POST /auth/v1/verify': [
        403,
        { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' },
      ],
    });
    await expect(
      provider.verifyEmailCode({ email: 'tahmid@example.com', code: '000000' }),
    ).resolves.toEqual({ status: 'invalid_code' });
  });

  it('resends the signup code', async () => {
    const { provider, calls } = fakeSupabase({ 'POST /auth/v1/resend': [200, {}] });
    await expect(provider.resendEmailCode({ email: 'tahmid@example.com' })).resolves.toEqual({
      status: 'sent',
    });
    expect(calls[0]?.body).toMatchObject({ email: 'tahmid@example.com', type: 'signup' });
  });

  it('deletes users with the service role key', async () => {
    const id = user([]).id;
    const { provider, calls } = fakeSupabase({
      [`DELETE /auth/v1/admin/users/${id}`]: [200, {}],
    });
    await provider.deleteUser(id);
    expect(calls[0]).toMatchObject({ method: 'DELETE', apikey: 'service-role-key' });
  });

  it('throws when deleting a user fails', async () => {
    const { provider } = fakeSupabase({
      'DELETE /auth/v1/admin/users/missing': [
        404,
        { code: 404, error_code: 'user_not_found', msg: 'nope' },
      ],
    });
    await expect(provider.deleteUser('missing')).rejects.toThrow();
  });

  const session = {
    access_token: 'access-1',
    token_type: 'bearer',
    expires_in: 600,
    expires_at: 1790000600,
    refresh_token: 'refresh-1',
    user: user([{ id: 'identity-1' }]),
  };

  it('signs in with a password and returns the session', async () => {
    const { provider, calls } = fakeSupabase({
      'POST /auth/v1/token?grant_type=password': [200, session],
    });
    await expect(
      provider.signInWithPassword({ email: 'tahmid@example.com', password: 'secret-pass' }),
    ).resolves.toEqual({
      status: 'signed_in',
      session: {
        providerUserId: user([]).id,
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: new Date(1790000600 * 1000),
      },
    });
    expect(calls[0]?.apikey).toBe('anon-key');
  });

  it.each([
    [
      { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
      'invalid_credentials',
    ],
    [
      { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' },
      'email_not_verified',
    ],
  ])('maps sign-in error %j', async (body, status) => {
    const { provider } = fakeSupabase({
      'POST /auth/v1/token?grant_type=password': [400, body],
    });
    await expect(
      provider.signInWithPassword({ email: 'tahmid@example.com', password: 'secret-pass' }),
    ).resolves.toEqual({ status });
  });

  it('checks an access token by asking Supabase for its user', async () => {
    const { provider, calls } = fakeSupabase({ 'GET /auth/v1/user': [200, user([{ id: 'i' }])] });
    await expect(provider.checkAccessToken('access-1')).resolves.toEqual({
      status: 'valid',
      providerUserId: user([]).id,
    });
    expect(calls[0]?.authorization).toBe('Bearer access-1');
  });

  it('treats a rejected access token as invalid', async () => {
    const { provider } = fakeSupabase({
      'GET /auth/v1/user': [403, { code: 403, error_code: 'bad_jwt', msg: 'invalid JWT' }],
    });
    await expect(provider.checkAccessToken('forged')).resolves.toEqual({ status: 'invalid' });
  });

  it('refreshes a session and maps a revoked refresh token to invalid', async () => {
    const ok = fakeSupabase({ 'POST /auth/v1/token?grant_type=refresh_token': [200, session] });
    await expect(ok.provider.refreshSession('refresh-0')).resolves.toMatchObject({
      status: 'refreshed',
      session: { accessToken: 'access-1', refreshToken: 'refresh-1' },
    });
    expect(ok.calls[0]?.body).toMatchObject({ refresh_token: 'refresh-0' });

    const revoked = fakeSupabase({
      'POST /auth/v1/token?grant_type=refresh_token': [
        400,
        { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' },
      ],
    });
    await expect(revoked.provider.refreshSession('refresh-0')).resolves.toEqual({
      status: 'invalid',
    });
  });

  it.each([
    ['this_device', 'local'],
    ['other_devices', 'others'],
  ] as const)('signs out %s with scope=%s', async (scope, supabaseScope) => {
    const { provider, calls } = fakeSupabase({
      [`POST /auth/v1/logout?scope=${supabaseScope}`]: [204, {}],
    });
    await provider.signOut('access-1', scope);
    expect(calls[0]).toMatchObject({
      apikey: 'service-role-key',
      authorization: 'Bearer access-1',
    });
  });

  it('ignores signing out a session that is already gone', async () => {
    const { provider } = fakeSupabase({
      'POST /auth/v1/logout?scope=local': [
        404,
        { code: 404, error_code: 'session_not_found', msg: 'Session not found' },
      ],
    });
    await expect(provider.signOut('access-1', 'this_device')).resolves.toBeUndefined();
  });
});
