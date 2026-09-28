/**
 * Identity provider (Supabase Auth in production, see ADR 0003).
 * Implementations must not leak provider types into the domain.
 */

/** Tokens for one signed-in device. Stored only in HTTP-only cookies. */
export interface AuthSession {
  providerUserId: string;
  accessToken: string;
  refreshToken: string;
  /** When the access token expires. */
  expiresAt: Date;
}

export type SignUpResult =
  | { status: 'created'; providerUserId: string }
  // The provider already knows this email. Callers must not reveal this (Q6).
  | { status: 'already_registered' }
  | { status: 'rate_limited' };

export type VerifyEmailCodeResult =
  { status: 'verified'; session: AuthSession } | { status: 'invalid_code' };

export type ResendEmailCodeResult = { status: 'sent' } | { status: 'rate_limited' };

export type SignInResult =
  | { status: 'signed_in'; session: AuthSession }
  /** Unknown email or wrong password; indistinguishable on purpose. */
  | { status: 'invalid_credentials' }
  /** Correct password, email not verified yet. */
  | { status: 'email_not_verified' }
  | { status: 'rate_limited' };

export type AccessTokenCheck = { status: 'valid'; providerUserId: string } | { status: 'invalid' };

export type RefreshResult = { status: 'refreshed'; session: AuthSession } | { status: 'invalid' };

export interface AuthProvider {
  /** Creates the login account and sends the 6-digit verification code by email. */
  signUpWithPassword(input: { email: string; password: string }): Promise<SignUpResult>;
  /** Confirms the email and signs the user in. */
  verifyEmailCode(input: { email: string; code: string }): Promise<VerifyEmailCodeResult>;
  resendEmailCode(input: { email: string }): Promise<ResendEmailCodeResult>;
  signInWithPassword(input: { email: string; password: string }): Promise<SignInResult>;
  /** Checks an access token. Expired, revoked-and-expired or forged tokens are invalid. */
  checkAccessToken(accessToken: string): Promise<AccessTokenCheck>;
  /** Exchanges a refresh token for new tokens. Revoked sessions cannot refresh. */
  refreshSession(refreshToken: string): Promise<RefreshResult>;
  /** Ends the session behind `accessToken` ('this_device') or every other session of that user. */
  signOut(accessToken: string, scope: 'this_device' | 'other_devices'): Promise<void>;
  /** Removes a login account. Used to undo a signup whose app records could not be saved. */
  deleteUser(providerUserId: string): Promise<void>;
}
