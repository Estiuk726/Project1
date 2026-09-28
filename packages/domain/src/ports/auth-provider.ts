/**
 * Identity provider (Supabase Auth in production, see ADR 0003).
 * Implementations must not leak provider types into the domain.
 */
export type SignUpResult =
  | { status: 'created'; providerUserId: string }
  // The provider already knows this email. Callers must not reveal this (Q6).
  | { status: 'already_registered' }
  | { status: 'rate_limited' };

export type VerifyEmailCodeResult =
  { status: 'verified'; providerUserId: string } | { status: 'invalid_code' };

export type ResendEmailCodeResult = { status: 'sent' } | { status: 'rate_limited' };

export interface AuthProvider {
  /** Creates the login account and sends the 6-digit verification code by email. */
  signUpWithPassword(input: { email: string; password: string }): Promise<SignUpResult>;
  verifyEmailCode(input: { email: string; code: string }): Promise<VerifyEmailCodeResult>;
  resendEmailCode(input: { email: string }): Promise<ResendEmailCodeResult>;
  /** Removes a login account. Used to undo a signup whose app records could not be saved. */
  deleteUser(providerUserId: string): Promise<void>;
}
