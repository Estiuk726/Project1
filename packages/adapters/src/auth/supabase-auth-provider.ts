import type {
  AccessTokenCheck,
  AuthProvider,
  AuthSession,
  RefreshResult,
  ResendEmailCodeResult,
  SignInResult,
  SignUpResult,
  VerifyEmailCodeResult,
} from '@flightmates/domain';
import {
  createClient,
  isAuthApiError,
  isAuthSessionMissingError,
  type Session,
} from '@supabase/supabase-js';

export interface SupabaseAuthConfig {
  url: string;
  anonKey: string;
  /** Server-only secret. Used for admin calls (deleting a user, ending sessions). */
  serviceRoleKey: string;
  /** Injected in tests. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

function isRateLimited(error: unknown): boolean {
  return isAuthApiError(error) && error.status === 429;
}

/** Wrong, expired or already used one-time code. */
function isInvalidCode(error: unknown): boolean {
  return (
    isAuthApiError(error) &&
    (error.code === 'otp_expired' || error.status === 403 || error.status === 400)
  );
}

function toAuthSession(session: Session): AuthSession {
  const expiresAtSeconds = session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in;
  return {
    providerUserId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: new Date(expiresAtSeconds * 1000),
  };
}

/** Supabase Auth implementation of the AuthProvider port (ADR 0003). */
export function createSupabaseAuthProvider(config: SupabaseAuthConfig): AuthProvider {
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(config.fetch ? { global: { fetch: config.fetch } } : {}),
  };
  // supabase-js keeps the last session in memory on the client. A fresh client per call keeps
  // one user's session from ever being visible to another request.
  const userClient = () => createClient(config.url, config.anonKey, options);
  const admin = createClient(config.url, config.serviceRoleKey, options);

  return {
    async signUpWithPassword({ email, password }): Promise<SignUpResult> {
      const { data, error } = await userClient().auth.signUp({ email, password });
      if (error) {
        if (isRateLimited(error)) return { status: 'rate_limited' };
        throw error;
      }
      // With email confirmation on, Supabase hides existing verified accounts by
      // returning a user with no identities instead of an error.
      if (!data.user || data.user.identities?.length === 0) {
        return { status: 'already_registered' };
      }
      return { status: 'created', providerUserId: data.user.id };
    },

    async verifyEmailCode({ email, code }): Promise<VerifyEmailCodeResult> {
      const { data, error } = await userClient().auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });
      if (error) {
        if (isInvalidCode(error)) return { status: 'invalid_code' };
        throw error;
      }
      if (!data.session) return { status: 'invalid_code' };
      return { status: 'verified', session: toAuthSession(data.session) };
    },

    async resendEmailCode({ email }): Promise<ResendEmailCodeResult> {
      const { error } = await userClient().auth.resend({ type: 'signup', email });
      if (error) {
        if (isRateLimited(error)) return { status: 'rate_limited' };
        throw error;
      }
      return { status: 'sent' };
    },

    async signInWithPassword({ email, password }): Promise<SignInResult> {
      const { data, error } = await userClient().auth.signInWithPassword({ email, password });
      if (error) {
        if (isRateLimited(error)) return { status: 'rate_limited' };
        if (isAuthApiError(error) && error.code === 'email_not_confirmed') {
          return { status: 'email_not_verified' };
        }
        if (
          isAuthApiError(error) &&
          (error.code === 'invalid_credentials' || error.status === 400)
        ) {
          return { status: 'invalid_credentials' };
        }
        throw error;
      }
      return { status: 'signed_in', session: toAuthSession(data.session) };
    },

    async checkAccessToken(accessToken): Promise<AccessTokenCheck> {
      const { data, error } = await userClient().auth.getUser(accessToken);
      if (error) {
        if (isAuthApiError(error) && error.status >= 400 && error.status < 500) {
          return { status: 'invalid' };
        }
        throw error;
      }
      return { status: 'valid', providerUserId: data.user.id };
    },

    async refreshSession(refreshToken): Promise<RefreshResult> {
      const { data, error } = await userClient().auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (error) {
        if (isAuthApiError(error) && error.status >= 400 && error.status < 500) {
          return { status: 'invalid' };
        }
        throw error;
      }
      if (!data.session) return { status: 'invalid' };
      return { status: 'refreshed', session: toAuthSession(data.session) };
    },

    async signOut(accessToken, scope): Promise<void> {
      const { error } = await admin.auth.admin.signOut(
        accessToken,
        scope === 'this_device' ? 'local' : 'others',
      );
      // An already ended session is fine: the goal is that it no longer works.
      const alreadyGone =
        isAuthSessionMissingError(error) ||
        (isAuthApiError(error) && (error.status === 401 || error.status === 404));
      if (error && !alreadyGone) throw error;
    },

    async deleteUser(providerUserId): Promise<void> {
      const { error } = await admin.auth.admin.deleteUser(providerUserId);
      if (error) throw error;
    },
  };
}
