/** Where an unexpected error happened. IDs and route only, never request data. */
export interface ErrorContext {
  requestId: string;
  method: string;
  route: string;
}

/** Error tracking service (PRD 14.1). Implementations redact before sending. */
export interface ErrorTracker {
  capture(error: unknown, context: ErrorContext): void;
  /**
   * Waits up to timeoutMs for captured errors to be sent. Serverless functions can be frozen
   * as soon as the response is returned (ADR 0005), so the 500 path awaits this first.
   */
  flush(timeoutMs: number): Promise<void>;
}
