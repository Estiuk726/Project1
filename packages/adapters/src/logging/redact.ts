// Second layer of the logging rule in CLAUDE.md: callers log IDs only, and anything that
// slips through is masked here before it leaves the process.

export const REDACTED = '[redacted]';

/** Keys whose values are never logged, compared lowercase with separators removed. */
const SENSITIVE_KEYS = new Set([
  'email',
  'emailaddress',
  'password',
  'token',
  'authorization',
  'cookie',
  'setcookie',
  'secret',
  'apikey',
  'dsn',
  'dob',
  'dateofbirth',
  'birthdate',
  'phone',
  'phonenumber',
  'surname',
  'lastname',
  'familyname',
  'homecity',
  'seat',
  'seatnumber',
  'body',
  'messagebody',
  'content',
  'text',
  'note',
  'bio',
  'code',
  'otp',
  'flight',
  'flights',
  'flightnumber',
  'departuredate',
  'pnr',
  'bookingreference',
  'passport',
]);

/** Suffixes that make any key sensitive: accessToken, refresh_token, newPassword, userEmail. */
const SENSITIVE_SUFFIXES = ['token', 'password', 'secret', 'email', 'cookie'];

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER = /\bBearer\s+\S+/gi;

const MAX_DEPTH = 6;
const MAX_ARRAY = 50;
const MAX_STRING = 2000;

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_KEYS.has(normalized) || SENSITIVE_SUFFIXES.some((s) => normalized.endsWith(s));
}

/** Masks emails, JWTs and bearer tokens inside free text. */
export function scrubText(text: string): string {
  const scrubbed = text
    .replace(EMAIL, '[email]')
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]');
  return scrubbed.length > MAX_STRING ? `${scrubbed.slice(0, MAX_STRING)}…` : scrubbed;
}

/**
 * Error messages can quote the values that caused them (Postgres "Key (email)=(…)"), so an
 * error is reduced to its name, a short machine code and its stack frames.
 */
function serializeError(error: Error, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = { name: error.name };
  const code: unknown = (error as { code?: unknown }).code;
  if (
    (typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code)) ||
    typeof code === 'number'
  ) {
    out.code = code;
  }
  const frames = (error.stack ?? '')
    .split('\n')
    .filter((line) => line.trimStart().startsWith('at '))
    .map((line) => scrubText(line.trim()));
  if (frames.length > 0) out.stack = frames;
  if (error.cause !== undefined && depth < MAX_DEPTH) {
    out.cause =
      error.cause instanceof Error ? serializeError(error.cause, depth + 1) : typeof error.cause;
  }
  return out;
}

/** Returns a JSON-safe copy with sensitive keys masked and free text scrubbed. */
export function redact(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet());
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  switch (typeof value) {
    case 'string':
      return scrubText(value);
    case 'number':
    case 'boolean':
      return value;
    case 'bigint':
      return value.toString();
    case 'function':
    case 'symbol':
      return undefined;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value, depth);
  if (depth >= MAX_DEPTH) return '[depth]';
  const object = value;
  if (seen.has(object)) return '[circular]';
  seen.add(object);
  if (Array.isArray(object)) {
    return object.slice(0, MAX_ARRAY).map((item) => redactValue(item, depth + 1, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(object)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redactValue(item, depth + 1, seen);
  }
  return out;
}
