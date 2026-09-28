import { describe, expect, it, vi } from 'vitest';
import { createSentryErrorTracker } from './sentry-error-tracker';

const DSN = 'https://publickey123@o4501.ingest.de.sentry.io/4502';

function fakeSentry() {
  const requests: { url: string; body: string }[] = [];
  // The transport always sends a string URL and a string envelope body.
  const fetch = vi.fn((url: string, init: { body: string }) => {
    requests.push({ url, body: init.body });
    return Promise.resolve(new Response('{}', { status: 200 }));
  });
  return { requests, fetch: fetch as unknown as typeof globalThis.fetch };
}

/** An envelope is newline-delimited JSON: envelope header, item header, item payload. */
function eventFrom(body: string): Record<string, unknown> {
  const [, , payload = '{}'] = body.split('\n');
  return JSON.parse(payload) as Record<string, unknown>;
}

describe('createSentryErrorTracker', () => {
  it('sends only the error type, stack frames and request tags to the EU ingest host', async () => {
    const sentry = fakeSentry();
    const tracker = createSentryErrorTracker({
      dsn: DSN,
      environment: 'staging',
      release: 'abc123',
      fetch: sentry.fetch,
    });

    const cause = new Error('Key (email)=(tahmid@example.com) already exists');
    const error = new TypeError('failed for tahmid@example.com: "See you at gate B7"', { cause });
    tracker.capture(error, { requestId: 'req-1', method: 'POST', route: '/api/v1/auth/signup' });

    await vi.waitFor(() => {
      expect(sentry.requests).toHaveLength(1);
    });
    const request = sentry.requests[0];
    expect(request?.url).toMatch(/^https:\/\/o4501\.ingest\.de\.sentry\.io\/api\/4502\/envelope\//);
    expect(request?.body).not.toContain('tahmid@example.com');
    expect(request?.body).not.toContain('gate B7');
    expect(request?.body).not.toContain('already exists');

    const event = eventFrom(request?.body ?? '');
    expect(Object.keys(event).sort()).toEqual(
      [
        'environment',
        'event_id',
        'exception',
        'level',
        'platform',
        'release',
        'sdk',
        'tags',
        'timestamp',
      ].sort(),
    );
    expect(event).toMatchObject({
      environment: 'staging',
      release: 'abc123',
      tags: { request_id: 'req-1', method: 'POST', route: '/api/v1/auth/signup' },
    });
    const values = (event.exception as { values: Record<string, unknown>[] }).values;
    // linkedErrors adds the cause; both keep type and frames, neither keeps its message.
    expect(values.map((v) => v.type)).toEqual(['Error', 'TypeError']);
    for (const value of values) {
      expect(value).not.toHaveProperty('value');
      const frames = (value.stacktrace as { frames: Record<string, unknown>[] }).frames;
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.some((f) => String(f.filename).endsWith('sentry-error-tracker.test.ts'))).toBe(
        true,
      );
    }
  });

  it('sends non-Error values without their content', async () => {
    const sentry = fakeSentry();
    const tracker = createSentryErrorTracker({
      dsn: DSN,
      environment: 'local',
      fetch: sentry.fetch,
    });
    tracker.capture(
      { email: 'tahmid@example.com', token: 'eyJhbGciOiJIUzI1NiJ9.e30.sig' },
      {
        requestId: 'req-2',
        method: 'GET',
        route: '/api/v1/me',
      },
    );
    await vi.waitFor(() => {
      expect(sentry.requests).toHaveLength(1);
    });
    const body = sentry.requests[0]?.body ?? '';
    expect(body).not.toContain('tahmid@example.com');
    expect(body).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(eventFrom(body)).toMatchObject({ tags: { request_id: 'req-2' } });
  });
});
