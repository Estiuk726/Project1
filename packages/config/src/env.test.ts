import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseServerEnv } from './env';

const validUrl = 'postgres://app:s3cret-pass@db.example.com:6543/postgres';

function captureError(fn: () => unknown): EnvValidationError {
  try {
    fn();
  } catch (error) {
    if (error instanceof EnvValidationError) return error;
    throw error;
  }
  throw new Error('expected EnvValidationError');
}

describe('parseServerEnv', () => {
  it('returns typed values for a valid environment', () => {
    expect(parseServerEnv({ DATABASE_URL: validUrl, NODE_ENV: 'production' })).toEqual({
      DATABASE_URL: validUrl,
      NODE_ENV: 'production',
    });
  });

  it('defaults NODE_ENV to development', () => {
    expect(parseServerEnv({ DATABASE_URL: validUrl }).NODE_ENV).toBe('development');
  });

  it('accepts postgresql:// URLs', () => {
    const url = 'postgresql://postgres@localhost:5432/flightmates';
    expect(parseServerEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it.each([
    ['missing', {}],
    ['empty', { DATABASE_URL: '' }],
  ])('rejects a %s DATABASE_URL and names it', (_label, source) => {
    const error = captureError(() => parseServerEnv(source));
    expect(error.problems).toEqual(['DATABASE_URL is required']);
    expect(error.message).toContain('DATABASE_URL is required');
  });

  it('lists every problem at once', () => {
    const error = captureError(() => parseServerEnv({ NODE_ENV: 'staging' }));
    expect(error.problems).toEqual([
      'NODE_ENV has an unsupported value',
      'DATABASE_URL is required',
    ]);
  });

  it('never includes the rejected value in the error', () => {
    const secret = 'mysql://root:hunter2-top-secret@db.internal/prod';
    const error = captureError(() =>
      parseServerEnv({ DATABASE_URL: secret, NODE_ENV: 'super-secret-mode' }),
    );
    expect(error.problems).toContain('DATABASE_URL must be a postgres:// or postgresql:// URL');
    expect(error.message).not.toContain('hunter2');
    expect(error.message).not.toContain('super-secret-mode');
    expect(JSON.stringify(error.problems)).not.toContain('hunter2');
  });
});
