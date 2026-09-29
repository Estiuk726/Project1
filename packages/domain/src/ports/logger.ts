/**
 * Structured logging. Events are short dotted names ("request.completed"); fields carry IDs,
 * statuses and durations. Never pass message bodies, emails, DOB, tokens or flight details
 * tied to a user. Implementations redact known sensitive fields as a second layer.
 */
export type LogFields = Record<string, unknown>;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}
