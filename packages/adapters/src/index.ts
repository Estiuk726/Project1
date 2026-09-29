// Provider implementations behind the ports in @flightmates/domain.
export { noopAnalytics } from './analytics/noop-analytics';
export { createSupabaseAuthProvider, type SupabaseAuthConfig } from './auth/supabase-auth-provider';
export { noopErrorTracker } from './errors/noop-error-tracker';
export {
  createSentryErrorTracker,
  scrubEvent,
  type SentryErrorTrackerConfig,
} from './errors/sentry-error-tracker';
export { createJsonLogger, type JsonLoggerOptions } from './logging/json-logger';
export { isSensitiveKey, redact, REDACTED, scrubText } from './logging/redact';
