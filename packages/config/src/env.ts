import { z } from 'zod';

/** Treats an empty string as unset, so `NAME=` in a .env file means "not configured". */
function optional<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

/**
 * Server-side environment. Add a variable here when a ticket needs it, and to .env.example.
 * Values are secrets or infrastructure details: errors name variables, never their values.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string({ error: 'is required' })
    .min(1, { error: 'is required', abort: true })
    .refine((value) => /^postgres(ql)?:\/\/.+/.test(value), {
      error: 'must be a postgres:// or postgresql:// URL',
    }),
  // Supabase Auth (ADR 0003). The service role key is a server-only secret.
  SUPABASE_URL: z
    .string({ error: 'is required' })
    .min(1, { error: 'is required', abort: true })
    .refine((value) => /^https?:\/\/.+/.test(value), { error: 'must be an http(s) URL' }),
  SUPABASE_ANON_KEY: z.string({ error: 'is required' }).min(1, { error: 'is required' }),
  SUPABASE_SERVICE_ROLE_KEY: z.string({ error: 'is required' }).min(1, { error: 'is required' }),
  // Error tracking (ADR 0004). Unset: errors are logged but not sent anywhere. Only the EU
  // data region is accepted, so error reports stay in the EU with the rest of the data.
  SENTRY_DSN: optional(
    z
      .string()
      .refine((value) => /^https:\/\/[^@/]+@[a-z0-9.-]+\.de\.sentry\.io\/\d+$/.test(value), {
        error: 'must be a Sentry DSN in the EU region (https://…@….de.sentry.io/<project>)',
      }),
  ),
  SENTRY_ENVIRONMENT: optional(
    z.string().refine((value) => /^[a-z0-9-]{1,32}$/.test(value), {
      error: 'must be lowercase letters, digits or dashes (e.g. staging, production)',
    }),
  ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/** Validates the given environment (usually process.env). Throws EnvValidationError. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(root)';
    // Zod's default messages can echo the received value; only use our own or generic text.
    const message = issue.code === 'invalid_value' ? 'has an unsupported value' : issue.message;
    return `${name} ${message}`;
  });
  throw new EnvValidationError(problems);
}
