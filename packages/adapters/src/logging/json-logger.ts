import type { LogFields, Logger, LogLevel } from '@flightmates/domain';
import { redact } from './redact';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const RESERVED = new Set(['time', 'level', 'event']);

export interface JsonLoggerOptions {
  /** Lowest level written. Default "info". */
  level?: LogLevel;
  /** Receives one JSON line per event. Default: stdout. */
  write?: (line: string) => void;
  now?: () => Date;
}

/** Structured JSON logs, one line per event, with every field redacted (PRD 14.1). */
export function createJsonLogger(options: JsonLoggerOptions = {}): Logger {
  const minimum = LEVEL_ORDER[options.level ?? 'info'];
  const write =
    options.write ??
    ((line: string) => {
      console.log(line);
    });
  const now = options.now ?? (() => new Date());

  const log = (level: LogLevel, event: string, fields: LogFields = {}) => {
    if (LEVEL_ORDER[level] < minimum) return;
    const safe = redact(fields) as Record<string, unknown>;
    const record: Record<string, unknown> = { time: now().toISOString(), level, event };
    for (const [key, value] of Object.entries(safe)) {
      if (!RESERVED.has(key)) record[key] = value;
    }
    write(JSON.stringify(record));
  };

  return {
    debug: (event, fields) => {
      log('debug', event, fields);
    },
    info: (event, fields) => {
      log('info', event, fields);
    },
    warn: (event, fields) => {
      log('warn', event, fields);
    },
    error: (event, fields) => {
      log('error', event, fields);
    },
  };
}
