import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const signupRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  email,
  // 72 is the bcrypt input limit used by Supabase Auth.
  password: z.string().min(8).max(72),
  dateOfBirth: z.iso.date().refine((value) => value >= '1900-01-01', {
    error: 'must be on or after 1900-01-01',
  }),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const verifyEmailRequestSchema = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, { error: 'must be 6 digits' }),
});
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const resendCodeRequestSchema = z.object({ email });
export type ResendCodeRequest = z.infer<typeof resendCodeRequestSchema>;

export const verificationPendingResponseSchema = z.object({
  status: z.literal('verification_pending'),
});
export const emailVerifiedResponseSchema = z.object({ status: z.literal('verified') });
export const codeSentResponseSchema = z.object({ status: z.literal('code_sent') });
