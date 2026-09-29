import type { ErrorResponse, FieldProblem } from '@flightmates/contracts';
import {
  DomainError,
  type AccountDeps,
  type DomainErrorCode,
  type ErrorTracker,
  type Logger,
} from '@flightmates/domain';
import type { z } from 'zod';

export interface Observability {
  logger: Logger;
  errorTracker: ErrorTracker;
}

/** Everything a route handler needs: domain services plus logging and error tracking. */
export type RouteDeps = AccountDeps & Observability;

export const REQUEST_ID_HEADER = 'x-request-id';

/** Upper bound added to a 500 response while the error report is sent. */
const ERROR_FLUSH_TIMEOUT_MS = 2000;

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

/**
 * Runs a route handler. Expected domain failures become 4xx; anything else is logged, sent
 * to error tracking and answered with a 500 that carries no internal detail. Every response
 * gets a request ID so a user report can be matched to the logs.
 */
export async function handleErrors(
  request: Request,
  deps: Observability,
  run: () => Promise<Response>,
): Promise<Response> {
  const started = performance.now();
  const requestId = crypto.randomUUID();
  const method = request.method;
  // Path only: query strings can carry flight numbers and dates.
  const route = new URL(request.url).pathname;
  let errorCode: string | undefined;
  let response: Response;
  try {
    response = await run();
  } catch (error) {
    if (error instanceof DomainError) {
      errorCode = error.code;
      response = errorResponse(domainErrorStatus[error.code], error.code, error.message);
    } else {
      errorCode = 'INTERNAL';
      deps.logger.error('request.failed', { requestId, method, route, error });
      try {
        deps.errorTracker.capture(error, { requestId, method, route });
        await deps.errorTracker.flush(ERROR_FLUSH_TIMEOUT_MS);
      } catch {
        // Error tracking must never change the response.
      }
      response = errorResponse(500, 'INTERNAL', 'Something went wrong. Please try again.');
    }
  }
  response.headers.set(REQUEST_ID_HEADER, requestId);
  deps.logger.info('request.completed', {
    requestId,
    method,
    route,
    status: response.status,
    ...(errorCode ? { errorCode } : {}),
    durationMs: Math.round(performance.now() - started),
  });
  return response;
}
