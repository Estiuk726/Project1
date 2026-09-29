// Smoke test for a deployed environment (F-07). Usage:
//   pnpm smoke:auth https://staging.example.com
//     Checks the API answers, sets request IDs and blocks cross-site requests. Used by CI.
//   pnpm smoke:auth https://staging.example.com --signup you+smoke1@example.com
//     Full auth flow with a real inbox: signup, then asks for the emailed 6-digit code,
//     verify, GET /me, logout, and checks the old session is rejected.
// Prints statuses and request IDs only; the password is random and never printed.
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const [baseArg, flag, email] = process.argv.slice(2);
if (!baseArg || (flag !== undefined && (flag !== '--signup' || !email))) {
  console.error('Usage: pnpm smoke:auth <base-url> [--signup <email>]');
  process.exit(2);
}
const base = new URL(baseArg).origin;
let cookies = '';
let failures = 0;

async function call(
  method: string,
  path: string,
  options: { body?: unknown; origin?: string; withCookies?: boolean } = {},
): Promise<Response> {
  const headers = new Headers({ origin: options.origin ?? base });
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  if (options.withCookies !== false && cookies) headers.set('cookie', cookies);
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    redirect: 'manual',
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const set = response.headers.getSetCookie().map((c) => c.split(';')[0] ?? '');
  if (set.length > 0) cookies = set.filter((c) => !c.endsWith('=')).join('; ');
  return response;
}

async function expectStatus(label: string, response: Response, status: number): Promise<void> {
  const requestId = response.headers.get('x-request-id') ?? 'missing';
  const ok = response.status === status && requestId !== 'missing';
  if (!ok) failures += 1;
  let code = '';
  if (response.status >= 400) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    code = body?.error?.code ? ` ${body.error.code}` : '';
  }
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label}: ${String(response.status)}${code} (expected ${String(status)}), request ${requestId}`,
  );
}

await expectStatus('GET /me without a session', await call('GET', '/api/v1/me'), 401);
await expectStatus(
  'POST /auth/login from another site',
  await call('POST', '/api/v1/auth/login', {
    body: { email: 'nobody@example.com', password: 'x' },
    origin: 'https://evil.example',
  }),
  403,
);

if (email) {
  const password = randomBytes(18).toString('base64url');
  await expectStatus(
    'POST /auth/signup',
    await call('POST', '/api/v1/auth/signup', {
      body: { firstName: 'Smoke', email, password, dateOfBirth: '2000-01-01' },
    }),
    202,
  );
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await prompt.question('6-digit code from the email: ')).trim();
  prompt.close();
  await expectStatus(
    'POST /auth/verify-email',
    await call('POST', '/api/v1/auth/verify-email', { body: { email, code } }),
    200,
  );
  await expectStatus('GET /me with the session', await call('GET', '/api/v1/me'), 200);
  await expectStatus(
    'POST /auth/login',
    await call('POST', '/api/v1/auth/login', { body: { email, password } }),
    200,
  );
  const session = cookies;
  await expectStatus(
    'POST /auth/logout',
    await call('POST', '/api/v1/auth/logout', { body: {} }),
    204,
  );
  cookies = session;
  await expectStatus('GET /me with the logged-out session', await call('GET', '/api/v1/me'), 401);
}

if (failures > 0) {
  console.error(`${String(failures)} check(s) failed.`);
  process.exit(1);
}
console.log('All checks passed.');
