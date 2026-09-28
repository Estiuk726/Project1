import type { Analytics } from '@flightmates/domain';

/** Placeholder until the analytics pipeline exists (B-01). Records nothing. */
export const noopAnalytics: Analytics = {
  track: () => Promise.resolve(),
};
