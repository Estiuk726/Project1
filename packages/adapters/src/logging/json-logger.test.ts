import { describe, expect, it } from 'vitest';
import { createJsonLogger } from './json-logger';

function capture(level?: 'debug' | 'info' | 'warn' | 'error') {
  const lines: string[] = [];
  const logger = createJsonLogger({
    ...(level ? { level } : {}),
    write: (line) => lines.push(line),
    now: () => new Date('2026-09-28T10:00:00Z'),
  });
  return { logger, records: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>) };
}

describe('createJsonLogger', () => {
  it('writes one JSON line per event with time, level and event first', () => {
    const { logger, records } = capture();
    logger.info('request.completed', { requestId: 'r-1', status: 200 });
    expect(records()).toEqual([
      {
        time: '2026-09-28T10:00:00.000Z',
        level: 'info',
        event: 'request.completed',
        requestId: 'r-1',
        status: 200,
      },
    ]);
  });

  it('redacts fields before writing', () => {
    const { logger, records } = capture();
    logger.warn('signup.failed', { email: 'tahmid@example.com', reason: 'x tahmid@example.com' });
    expect(records()[0]).toMatchObject({ email: '[redacted]', reason: 'x [email]' });
  });

  it('does not let fields overwrite time, level or event', () => {
    const { logger, records } = capture();
    logger.error('real.event', { event: 'fake', level: 'debug', time: 'then' });
    expect(records()[0]).toMatchObject({ event: 'real.event', level: 'error' });
    expect(records()[0]?.time).toBe('2026-09-28T10:00:00.000Z');
  });

  it('skips events below the configured level', () => {
    const { logger, records } = capture('warn');
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    expect(records().map((r) => r.event)).toEqual(['c', 'd']);
  });
});
