import { describe, expect, it } from 'vitest';
import { isSensitiveKey, REDACTED, redact, scrubText } from './redact';

describe('redact', () => {
  it('masks sensitive keys at any depth, whatever their casing', () => {
    const out = redact({
      userId: 'u-1',
      email: 'tahmid@example.com',
      nested: {
        accessToken: 'abc',
        refresh_token: 'def',
        'Date-Of-Birth': '2002-03-12',
        profile: { surname: 'Rahman', home_city: 'Dhaka', seatNumber: '14C' },
      },
      messages: [{ id: 'm-1', body: 'meet at gate 4' }],
      flightNumber: 'QR 639',
      code: '123456',
    });
    expect(out).toEqual({
      userId: 'u-1',
      email: REDACTED,
      nested: {
        accessToken: REDACTED,
        refresh_token: REDACTED,
        'Date-Of-Birth': REDACTED,
        profile: { surname: REDACTED, home_city: REDACTED, seatNumber: REDACTED },
      },
      messages: [{ id: 'm-1', body: REDACTED }],
      flightNumber: REDACTED,
      code: REDACTED,
    });
  });

  it('scrubs emails, JWTs and bearer tokens inside free text', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    expect(scrubText(`user a.b+c@uni.ac.uk failed with ${jwt}`)).toBe(
      'user [email] failed with [token]',
    );
    expect(scrubText('Authorization: Bearer sk_live_123')).toBe('Authorization: Bearer [token]');
  });

  it('reduces errors to name, code and stack frames, dropping the message', () => {
    const cause = Object.assign(new Error('Key (email)=(tahmid@example.com) already exists'), {
      code: '23505',
    });
    const error = new Error('insert failed for tahmid@example.com', { cause });
    const out = redact({ error }) as { error: Record<string, unknown> };
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('tahmid@example.com');
    expect(serialized).not.toContain('already exists');
    expect(out.error.name).toBe('Error');
    expect(out.error.stack).toEqual(expect.arrayContaining([expect.stringMatching(/^at /)]));
    expect(out.error.cause).toMatchObject({ name: 'Error', code: '23505' });
  });

  it('drops error codes that could carry a value', () => {
    const error = Object.assign(new Error('x'), { code: 'bad value tahmid@example.com' });
    expect(redact(error)).not.toHaveProperty('code');
  });

  it('handles cycles, dates, bigints and functions', () => {
    const cyclic: Record<string, unknown> = { id: 'c-1', at: new Date('2026-09-28T10:00:00Z') };
    cyclic.self = cyclic;
    cyclic.big = 10n;
    cyclic.fn = () => 1;
    expect(redact(cyclic)).toEqual({
      id: 'c-1',
      at: '2026-09-28T10:00:00.000Z',
      self: '[circular]',
      big: '10',
      fn: undefined,
    });
  });

  it('treats ids, statuses and durations as safe', () => {
    for (const key of ['userId', 'requestId', 'status', 'durationMs', 'route', 'errorCode']) {
      expect(isSensitiveKey(key)).toBe(false);
    }
  });
});
