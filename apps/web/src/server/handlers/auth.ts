import {
  resendCodeRequestSchema,
  signupRequestSchema,
  verifyEmailRequestSchema,
} from '@flightmates/contracts';
import { resendVerificationCode, signUp, verifyEmail, type AccountDeps } from '@flightmates/domain';
import { handleErrors, json, parseBody } from '../http';

/** POST /api/v1/auth/signup (PRD 9.1). 202: a code was sent if the email can sign up. */
export function handleSignup(request: Request, deps: AccountDeps): Promise<Response> {
  return handleErrors(async () => {
    const body = await parseBody(request, signupRequestSchema);
    if (!body.ok) return body.response;
    return json(await signUp(deps, body.data), 202);
  });
}

/** POST /api/v1/auth/verify-email */
export function handleVerifyEmail(request: Request, deps: AccountDeps): Promise<Response> {
  return handleErrors(async () => {
    const body = await parseBody(request, verifyEmailRequestSchema);
    if (!body.ok) return body.response;
    return json(await verifyEmail(deps, body.data), 200);
  });
}

/** POST /api/v1/auth/resend-code */
export function handleResendCode(request: Request, deps: AccountDeps): Promise<Response> {
  return handleErrors(async () => {
    const body = await parseBody(request, resendCodeRequestSchema);
    if (!body.ok) return body.response;
    return json(await resendVerificationCode(deps, body.data), 202);
  });
}
