# ADR 0004: Error tracking with Sentry (EU region), scrubbed to an allowlist

- Status: Accepted
- Date: 2026-09-28
- Decides: PRD Section 14.1 "Errors and logs" (error tracking service), ticket F-06

## Context

PRD 14.1 asks for an error tracking service next to structured JSON logs. CLAUDE.md forbids logging message bodies, emails, DOB, tokens or flight details tied to a user, and every third-party service must sit behind a port. User data is kept in the EU (ADR 0002). Error reports are the most likely place for personal data to leak: error messages quote the values that caused them, and SDKs attach request bodies, cookies, headers and user IDs by default.

## Decision

- Use **Sentry** in its **EU data region** (`*.de.sentry.io`). The environment check rejects any `SENTRY_DSN` outside that region.
- Access it only through the `ErrorTracker` port. `handleErrors` calls it for unexpected errors (5xx), never for expected domain failures (4xx).
- Depend on **`@sentry/core` only**, not `@sentry/node` or `@sentry/nextjs`. The adapter is a small client with a Node stack parser and a fetch transport. Nothing is instrumented automatically: no HTTP, console or database hooks, no breadcrumbs, no tracing. `@sentry/node` v11 would add OpenTelemetry, auto-instrumentation and bundler plugins we would then have to switch off.
- Every event is **rebuilt from an allowlist** in `scrubEvent` before sending:
  - Kept: error types, stack frames (file, function, line, column), environment, release, and the tags `request_id`, `method` and `route` (path only).
  - Dropped: error messages, request data, user data, breadcrumbs, contexts and extra data.
- `SENTRY_DSN` is optional. Without it, errors are still logged as `request.failed` with the same request ID and nothing is sent.

## Consequences

- Sentry becomes a processor for the PRD 11.1 list, with EU storage. It holds no personal data by design.
- Issues show the error type and stack, not the message. To see what happened, look up the `request_id` tag in the logs, which have their own redaction.
- On serverless hosting, events are sent in the background and could be lost if the function is frozen first. When hosting is chosen (F-07), add a flush at the end of the request if needed.
- Tests check the actual envelope sent through a fake fetch, including an error whose message and cause contain an email and a message body.
- Replacing Sentry means a new `ErrorTracker` adapter and nothing else.
