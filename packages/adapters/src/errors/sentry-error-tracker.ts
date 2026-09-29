import type { ErrorContext, ErrorTracker } from '@flightmates/domain';
import {
  Client,
  Scope,
  createStackParser,
  createTransport,
  dedupeIntegration,
  eventFromMessage,
  eventFromUnknownInput,
  linkedErrorsIntegration,
  type BaseTransportOptions,
  type ClientOptions,
  type ErrorEvent,
  type Event,
  type EventHint,
  type Exception,
  type SeverityLevel,
  type StackFrame,
  type StackLineParser,
  type Transport,
} from '@sentry/core';

// ADR 0004. Built on @sentry/core only: nothing is instrumented automatically, so the only
// events that leave the process are the ones handed to capture(), after scrubEvent().

export interface SentryErrorTrackerConfig {
  dsn: string;
  environment: string;
  release?: string;
  /** Injected in tests. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

/** V8 stack lines: "at fn (file:line:col)" or "at file:line:col". */
const V8_FRAME = /^\s*at (?:(.+?) \()?(?:file:\/\/)?(.+?):(\d+):(\d+)\)?$/;

const nodeStackLineParser: StackLineParser = [
  50,
  (line) => {
    const match = V8_FRAME.exec(line);
    if (!match) return undefined;
    const [, fn, filename = '', lineno = '0', colno = '0'] = match;
    return {
      filename,
      function: fn ?? '?',
      lineno: Number(lineno),
      colno: Number(colno),
      in_app: !filename.includes('/node_modules/') && !filename.startsWith('node:'),
    };
  },
];

const stackParser = createStackParser(nodeStackLineParser);

const TAGS = ['request_id', 'method', 'route'] as const;

function scrubFrame(frame: StackFrame): StackFrame {
  return {
    ...(frame.filename ? { filename: frame.filename } : {}),
    ...(frame.function ? { function: frame.function } : {}),
    ...(frame.lineno !== undefined ? { lineno: frame.lineno } : {}),
    ...(frame.colno !== undefined ? { colno: frame.colno } : {}),
    ...(frame.in_app !== undefined ? { in_app: frame.in_app } : {}),
  };
}

function scrubException(exception: Exception): Exception {
  const frames = exception.stacktrace?.frames;
  return {
    ...(exception.type ? { type: exception.type } : {}),
    ...(exception.mechanism
      ? { mechanism: { type: exception.mechanism.type, handled: exception.mechanism.handled } }
      : {}),
    ...(frames ? { stacktrace: { frames: frames.map(scrubFrame) } } : {}),
  };
}

/**
 * Rebuilds the event from an allowlist: error types, stack frames and our three tags.
 * Error messages (which can quote personal data), request data, user data, breadcrumbs,
 * contexts and extra data are never sent.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const tags: Record<string, string> = {};
  for (const key of TAGS) {
    const value = event.tags?.[key];
    if (typeof value === 'string') tags[key] = value;
  }
  return {
    type: undefined,
    ...(event.event_id ? { event_id: event.event_id } : {}),
    ...(event.timestamp !== undefined ? { timestamp: event.timestamp } : {}),
    level: event.level ?? 'error',
    platform: 'node',
    ...(event.environment ? { environment: event.environment } : {}),
    ...(event.release ? { release: event.release } : {}),
    ...(event.sdk ? { sdk: event.sdk } : {}),
    tags,
    exception: { values: (event.exception?.values ?? []).map(scrubException) },
  };
}

class ServerErrorClient extends Client {
  // Client's constructor is protected; this makes it public.
  public constructor(options: ClientOptions) {
    super(options);
  }

  eventFromException(exception: unknown, hint?: EventHint): PromiseLike<Event> {
    return Promise.resolve(eventFromUnknownInput(this, stackParser, exception, hint));
  }

  eventFromMessage(message: string, level?: SeverityLevel, hint?: EventHint): PromiseLike<Event> {
    return Promise.resolve(eventFromMessage(stackParser, message, level, hint));
  }
}

function fetchTransport(send: typeof fetch) {
  return (options: BaseTransportOptions): Transport =>
    createTransport(options, async (request) => {
      const response = await send(options.url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-sentry-envelope' },
        body: request.body as string,
      });
      return {
        statusCode: response.status,
        headers: {
          'x-sentry-rate-limits': response.headers.get('x-sentry-rate-limits'),
          'retry-after': response.headers.get('retry-after'),
        },
      };
    });
}

/** Sends unexpected server errors to Sentry (EU region), scrubbed to an allowlist. */
export function createSentryErrorTracker(config: SentryErrorTrackerConfig): ErrorTracker {
  const client = new ServerErrorClient({
    dsn: config.dsn,
    environment: config.environment,
    ...(config.release ? { release: config.release } : {}),
    transport: fetchTransport(config.fetch ?? fetch),
    stackParser,
    integrations: [dedupeIntegration(), linkedErrorsIntegration()],
    sendClientReports: false,
    maxBreadcrumbs: 0,
    beforeSend: scrubEvent,
  });
  client.init();

  return {
    capture(error: unknown, context: ErrorContext): void {
      const scope = new Scope();
      scope.setTags({
        request_id: context.requestId,
        method: context.method,
        route: context.route,
      });
      client.captureException(error, { originalException: error }, scope);
    },
    async flush(timeoutMs: number): Promise<void> {
      await client.flush(timeoutMs);
    },
  };
}
