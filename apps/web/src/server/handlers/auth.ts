import {
  loginRequestSchema,
  resendCodeRequestSchema,
  signupRequestSchema,
  verifyEmailRequestSchema,
} from '@flightmates/contracts';
import {
  authenticate,
  DomainError,
  resendVerificationCode,
  signIn,
  signOut,
  signUp,
  verifyEmail,
  type AccountDeps,
} from '@flightmates/domain';
import { handleErrors, json, parseBody, rejectCrossSite } from '../http';
import { clearSessionCookies, readSessionCookies, setSessionCookies } from '../session';

/** POST /api/v1/auth/signup (PRD 9.1). 202: a code was sent if the email can sign up. */
export function handleSignup(request: Request, deps: AccountDeps): Promise<Response> {
  return handleErrors(async () => {
    const blocked = rejectCrossSite(request);
    if (blocked) return blocked;
    const body = await parseBody(request, signupRequestSchema);
    if (!body.ok) return body.response;
    return json(await signUp(deps, body.data), 202);
  });
}

/** POST /api/v1/auth/verify-email. Also signs the user in. */
export function handleVerifyEmail(request: Request, deps: AccountDeps): Promise<Response> {
  return handleErrors(async () => {
    const blocked = rejectCrossSite(request);
    if (blocked) return blocked;
    const body = await parseBody(request, verifyEmailRequestSchema);
    if (!body.ok) return body.response;
    const result = await verifyEmail(deps, body.data);
    const response = json({ status: result.status }, 200);
    setSessionCookies(response.headers, result.session, deps.clock.now());
    return response;
  });
}

/** POST /api/v1/auth/resend-code */
export function handleResendCode(request: Request, deps: AccountDeps): Promise<Response> {
  return handleErrors(async () => {
    const blocked = rejectCrossSite(request);
    if (blocked) return blocked;
    const body = await parseBody(request, resendCodeRequestSchema);
    if (!body.ok) return body.response;
    return json(await resendVerificationCode(deps, body.data), 202);
  });
}

/** POST /api/v1/auth/login */
export function handleLogin(request: Request, deps: AccountDeps): Promise<Response> {
  return handleErrors(async () => {
    const blocked = rejectCrossSite(request);
    if (blocked) return blocked;
    const body = await parseBody(request, loginRequestSchema);
    if (!body.ok) return body.response;
    const result = await signIn(deps, body.data);
    const response = json({ status: result.status }, 200);
    setSessionCookies(response.headers, result.session, deps.clock.now());
    return response;
  });
}

/** POST /api/v1/auth/logout. Always clears the cookies, even without a valid session. */
export function handleLogout(request: Request, deps: AccountDeps): Promise<Response> {
  return handleErrors(async () => {
    const blocked = rejectCrossSite(request);
    if (blocked) return blocked;
    try {
      // Refreshes first if needed, so an expired access token still ends its session.
      const auth = await authenticate(deps, readSessionCookies(request));
      await signOut(deps, auth.accessToken);
    } catch (error) {
      if (!(error instanceof DomainError && error.code === 'UNAUTHENTICATED')) throw error;
    }
    const response = new Response(null, { status: 204 });
    clearSessionCookies(response.headers);
    return response;
  });
}
