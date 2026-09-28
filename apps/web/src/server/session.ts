import {
  authenticate,
  DomainError,
  type AccountDeps,
  type AuthSession,
  type Authenticated,
} from '@flightmates/domain';
import { errorResponse } from './http';

export const ACCESS_COOKIE = 'fm_at';
export const REFRESH_COOKIE = 'fm_rt';
/** Open question Q8: a login lasts 30 days, renewed while the app is used. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type SessionDeps = Pick<AccountDeps, 'authProvider' | 'users'>;

function cookie(name: string, value: string, maxAgeSeconds: number): string {
  // HttpOnly: no page script can read it. Secure: HTTPS only (browsers allow localhost).
  // SameSite=Lax: not sent on cross-site POSTs.
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${String(maxAgeSeconds)}`;
}

export function setSessionCookies(headers: Headers, session: AuthSession, now = new Date()): void {
  const accessSeconds = Math.max(
    0,
    Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000),
  );
  headers.append('set-cookie', cookie(ACCESS_COOKIE, session.accessToken, accessSeconds));
  headers.append(
    'set-cookie',
    cookie(REFRESH_COOKIE, session.refreshToken, SESSION_MAX_AGE_SECONDS),
  );
}

export function clearSessionCookies(headers: Headers): void {
  headers.append('set-cookie', cookie(ACCESS_COOKIE, '', 0));
  headers.append('set-cookie', cookie(REFRESH_COOKIE, '', 0));
}

export function readSessionCookies(request: Request): {
  accessToken?: string;
  refreshToken?: string;
} {
  const tokens: { accessToken?: string; refreshToken?: string } = {};
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    let value: string;
    try {
      value = decodeURIComponent(raw);
    } catch {
      continue;
    }
    if (!value) continue;
    if (name === ACCESS_COOKIE) tokens.accessToken = value;
    if (name === REFRESH_COOKIE) tokens.refreshToken = value;
  }
  return tokens;
}

/**
 * Runs `handler` for the signed-in caller. Answers 401 and clears the cookies when there is
 * no usable session; stores refreshed tokens on the response.
 */
export async function withSession(
  request: Request,
  deps: SessionDeps,
  handler: (auth: Authenticated) => Promise<Response>,
): Promise<Response> {
  let auth: Authenticated;
  try {
    auth = await authenticate(deps, readSessionCookies(request));
  } catch (error) {
    if (error instanceof DomainError && error.code === 'UNAUTHENTICATED') {
      const response = errorResponse(401, error.code, error.message);
      clearSessionCookies(response.headers);
      return response;
    }
    throw error;
  }
  const response = await handler(auth);
  if (auth.refreshedSession) setSessionCookies(response.headers, auth.refreshedSession);
  return response;
}
