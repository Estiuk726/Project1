import type {
  AuthProvider,
  ResendEmailCodeResult,
  SignUpResult,
  VerifyEmailCodeResult,
} from '@flightmates/domain';
import { createClient, isAuthApiError } from '@supabase/supabase-js';

export interface SupabaseAuthConfig {
  url: string;
  anonKey: string;
  /** Server-only secret. Used for admin calls (deleting a user). */
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

/** Supabase Auth implementation of the AuthProvider port (ADR 0003). */
export function createSupabaseAuthProvider(config: SupabaseAuthConfig): AuthProvider {
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(config.fetch ? { global: { fetch: config.fetch } } : {}),
  };
  const client = createClient(config.url, config.anonKey, options);
  const admin = createClient(config.url, config.serviceRoleKey, options);

  return {
    async signUpWithPassword({ email, password }): Promise<SignUpResult> {
      const { data, error } = await client.auth.signUp({ email, password });
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
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) {
        if (isInvalidCode(error)) return { status: 'invalid_code' };
        throw error;
      }
      if (!data.user) return { status: 'invalid_code' };
      return { status: 'verified', providerUserId: data.user.id };
    },

    async resendEmailCode({ email }): Promise<ResendEmailCodeResult> {
      const { error } = await client.auth.resend({ type: 'signup', email });
      if (error) {
        if (isRateLimited(error)) return { status: 'rate_limited' };
        throw error;
      }
      return { status: 'sent' };
    },

    async deleteUser(providerUserId): Promise<void> {
      const { error } = await admin.auth.admin.deleteUser(providerUserId);
      if (error) throw error;
    },
  };
}
