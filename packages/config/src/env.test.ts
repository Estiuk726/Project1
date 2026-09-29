import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseServerEnv } from './env';

const validUrl = 'postgres://app:s3cret-pass@db.example.com:6543/postgres';
const supabase = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
};

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
    expect(parseServerEnv({ DATABASE_URL: validUrl, NODE_ENV: 'production', ...supabase })).toEqual(
      {
        DATABASE_URL: validUrl,
        NODE_ENV: 'production',
        ...supabase,
      },
    );
  });

  it('defaults NODE_ENV to development', () => {
    expect(parseServerEnv({ DATABASE_URL: validUrl, ...supabase }).NODE_ENV).toBe('development');
  });

  it('accepts postgresql:// URLs', () => {
    const url = 'postgresql://postgres@localhost:5432/flightmates';
    expect(parseServerEnv({ DATABASE_URL: url, ...supabase }).DATABASE_URL).toBe(url);
  });

  it.each([
    ['missing', {}],
    ['empty', { DATABASE_URL: '' }],
  ])('rejects a %s DATABASE_URL and names it', (_label, source) => {
    const error = captureError(() => parseServerEnv({ ...supabase, ...source }));
    expect(error.problems).toEqual(['DATABASE_URL is required']);
    expect(error.message).toContain('DATABASE_URL is required');
  });

  it('lists every problem at once', () => {
    const error = captureError(() => parseServerEnv({ NODE_ENV: 'staging' }));
    expect(error.problems).toEqual([
      'NODE_ENV has an unsupported value',
      'DATABASE_URL is required',
      'SUPABASE_URL is required',
      'SUPABASE_ANON_KEY is required',
      'SUPABASE_SERVICE_ROLE_KEY is required',
    ]);
  });

  it('never includes the rejected value in the error', () => {
    const secret = 'mysql://root:hunter2-top-secret@db.internal/prod';
    const error = captureError(() =>
      parseServerEnv({ ...supabase, DATABASE_URL: secret, NODE_ENV: 'super-secret-mode' }),
    );
    expect(error.problems).toContain('DATABASE_URL must be a postgres:// or postgresql:// URL');
    expect(error.message).not.toContain('hunter2');
    expect(error.message).not.toContain('super-secret-mode');
    expect(JSON.stringify(error.problems)).not.toContain('hunter2');
  });

  it('rejects a non-URL SUPABASE_URL without echoing it', () => {
    const error = captureError(() =>
      parseServerEnv({ DATABASE_URL: validUrl, ...supabase, SUPABASE_URL: 'secret-host' }),
    );
    expect(error.problems).toEqual(['SUPABASE_URL must be an http(s) URL']);
    expect(error.message).not.toContain('secret-host');
  });

  describe('error tracking', () => {
    const base = { DATABASE_URL: validUrl, ...supabase };
    const dsn = 'https://publickey123@o4501.ingest.de.sentry.io/4502';

    it('is optional, and an empty value means unset', () => {
      const env = parseServerEnv({ ...base, SENTRY_DSN: '', SENTRY_ENVIRONMENT: '' });
      expect(env.SENTRY_DSN).toBeUndefined();
      expect(env.SENTRY_ENVIRONMENT).toBeUndefined();
    });

    it('accepts an EU-region DSN and an environment name', () => {
      const env = parseServerEnv({ ...base, SENTRY_DSN: dsn, SENTRY_ENVIRONMENT: 'staging' });
      expect(env).toMatchObject({ SENTRY_DSN: dsn, SENTRY_ENVIRONMENT: 'staging' });
    });

    it('rejects a DSN outside the EU region without echoing it', () => {
      const usDsn = 'https://publickey123@o4501.ingest.us.sentry.io/4502';
      const error = captureError(() => parseServerEnv({ ...base, SENTRY_DSN: usDsn }));
      expect(error.problems).toEqual([
        'SENTRY_DSN must be a Sentry DSN in the EU region (https://…@….de.sentry.io/<project>)',
      ]);
      expect(error.message).not.toContain('publickey123');
    });

    it('rejects an environment name with spaces or capitals', () => {
      const error = captureError(() =>
        parseServerEnv({ ...base, SENTRY_ENVIRONMENT: 'My Staging' }),
      );
      expect(error.problems).toHaveLength(1);
      expect(error.problems[0]).toMatch(/^SENTRY_ENVIRONMENT /);
    });
  });
});
