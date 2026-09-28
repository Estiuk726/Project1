import type { ErrorResponse, FieldProblem } from '@flightmates/contracts';
import { DomainError, type DomainErrorCode } from '@flightmates/domain';
import type { z } from 'zod';

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ErrorResponse = { error: { code, message, ...(details ? { details } : {}) } };
  return json(body, status);
}

const domainErrorStatus: Record<DomainErrorCode, number> = {
  UNDERAGE: 422,
  INVALID_CODE: 400,
  RATE_LIMITED: 429,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
  UNAUTHENTICATED: 401,
};

/**
 * Blocks cross-site requests to endpoints that act on the session cookie (CSRF).
 * Session cookies are SameSite=Lax as a second layer.
 */
export function rejectCrossSite(request: Request): Response | null {
  const forbidden = () =>
    errorResponse(403, 'FORBIDDEN_ORIGIN', 'Requests from other sites are not allowed.');
  if (request.headers.get('sec-fetch-site') === 'cross-site') return forbidden();
  const origin = request.headers.get('origin');
  // Non-browser clients send no Origin; SameSite=Lax cookies already cover browsers.
  if (origin === null) return null;
  let originHost: string;
  try {
    originHost = new URL(origin).host; // "null" (sandboxed pages) does not parse
  } catch {
    return forbidden();
  }
  return originHost === new URL(request.url).host ? null : forbidden();
}

/**
 * Parses a JSON body with a contract schema. On failure returns a 400 response that names
 * the fields and rules, never the submitted values.
 */
export async function parseBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<{ ok: true; data: z.infer<Schema> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: errorResponse(400, 'INVALID_INPUT', 'Request body must be JSON.'),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const details: FieldProblem[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      problem: issue.code,
    }));
    return {
      ok: false,
      response: errorResponse(400, 'INVALID_INPUT', 'Some fields are missing or invalid.', details),
    };
  }
  return { ok: true, data: result.data };
}

/** Maps expected domain failures to 4xx; anything else is a 500 with no internal detail. */
export async function handleErrors(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DomainError) {
      return errorResponse(domainErrorStatus[error.code], error.code, error.message);
    }
    // Structured logging with redaction arrives in F-06. Log the error type only.
    console.error(
      'Unhandled error in API route',
      error instanceof Error ? error.name : typeof error,
    );
    return errorResponse(500, 'INTERNAL', 'Something went wrong. Please try again.');
  }
}
