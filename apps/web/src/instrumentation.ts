import { EnvValidationError, parseServerEnv } from '@flightmates/config/env';

/**
 * Runs once when the Next.js server starts. An invalid environment stops the process with
 * exit code 1 and a message naming the variables, never their values (F-04).
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    parseServerEnv(process.env);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
