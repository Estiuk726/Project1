/** Where an unexpected error happened. IDs and route only, never request data. */
export interface ErrorContext {
  requestId: string;
  method: string;
  route: string;
}

/** Error tracking service (PRD 14.1). Implementations redact before sending. */
export interface ErrorTracker {
  capture(error: unknown, context: ErrorContext): void;
}
