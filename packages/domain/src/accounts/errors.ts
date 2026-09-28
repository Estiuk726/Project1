export type DomainErrorCode = 'UNDERAGE' | 'INVALID_CODE' | 'RATE_LIMITED';

/** An expected failure the API maps to a 4xx response. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
