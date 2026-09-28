import type { ErrorTracker } from '@flightmates/domain';

/** Placeholder until an error tracking service is chosen (F-06 part B). Sends nothing. */
export const noopErrorTracker: ErrorTracker = {
  capture: () => undefined,
};
