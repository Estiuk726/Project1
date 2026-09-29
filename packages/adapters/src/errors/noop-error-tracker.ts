import type { ErrorTracker } from '@flightmates/domain';

/** Used when SENTRY_DSN is unset (local development, tests). Errors are still logged. */
export const noopErrorTracker: ErrorTracker = {
  capture: () => undefined,
  flush: () => Promise.resolve(),
};
