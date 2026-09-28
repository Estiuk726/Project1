import { z } from 'zod';

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
