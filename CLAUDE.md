# FlightMates: instructions for Claude Code

FlightMates connects people travelling on the same flight or journey, starting with students flying South Asia ↔ Europe. The product spec is `docs/PRD.md`. The build order and tickets are `docs/BUILD_PLAN.md`. The UI rules are `docs/ux/design-system.md`. Read the relevant PRD sections before starting any ticket.

## How to work

- Work on one ticket at a time from `docs/BUILD_PLAN.md`. Do not start work outside the current ticket.
- Before writing code, post a short plan: files to touch, schema changes, endpoints, tests. Wait for approval if the plan changes the schema, an API contract, or an ADR.
- If the PRD is ambiguous or silent, stop and write the question in `docs/decisions/open-questions.md`. Do not invent product behavior.
- Items marked "Founder decision" in the PRD are not yours to decide. Use the stated proposed default only if the PRD says to.
- Finish each ticket with: summary of changes, how it was tested, anything left open. Update the ticket's status in `docs/BUILD_PLAN.md`.

## Architecture rules

- Business logic lives in `packages/domain`. Route handlers validate input, call a domain service, map the result. Nothing else.
- UI components never contain business rules, permission checks, or direct DB access.
- Every third-party service is used through an interface in `packages/domain/ports`. No provider types in domain entities.
- `packages/domain` must not import from `@flightmates/db`, `@flightmates/adapters`, `next` or `react` (enforced by lint).
- Validate every request with schemas from `packages/contracts`. The same schemas generate the OpenAPI spec.
- Authorize every protected resource on the server, including checks that the resource belongs to the caller or is visible to them.
- All endpoints live under `/api/v1` and use the standard error shape from PRD Section 16.
- Multi-step state changes run in one DB transaction.
- Timestamps are stored in UTC. Flight dates follow PRD Section 12.3 (local departure date at origin). Never derive a flight date from UTC.

## Database

- Every schema change is a new migration in `packages/db/migrations`. Never edit an applied migration.
- Propose schema changes in the plan before writing them.
- UUID primary keys. Foreign keys with explicit on-delete behavior. Unique constraints for every rule the PRD states as "only one".
- Add indexes only for real query paths and say which query each index serves.

## Privacy and safety (never break these)

- Never return fields the PRD lists as hidden in Section 9.2: email, phone, DOB, surname, home city, unrelated flights, seat.
- Every discovery, profile, request and message path must apply the block check in both directions and the filters in PRD Section 13.1.
- Never log message bodies, emails, DOB, tokens, or flight details tied to a user. Log IDs.
- Never commit secrets. Use `.env.example` with placeholder values.
- Every environment variable is declared in `packages/config/src/env.ts` (validated at server start) and listed in `.env.example`. Read it through `serverEnv()` in `apps/web/src/env.ts`, not `process.env`. Errors name variables, never values.
- Strip EXIF from uploaded images.

## UI

- Follow `docs/ux/design-system.md`: tokens, components, contrast and touch-target rules.
- 3 tabs only (Trips, Chats, Me). New screens need a PRD reference.

## Definition of done for every ticket

- Input validation, authorization, error handling.
- Unit tests for domain logic. Integration tests for DB-backed services.
- Authorization test that another user cannot access the resource.
- Block test where the feature involves another user.
- Analytics event emitted if the ticket touches the core loop (PRD Section 18.1).
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass. Migrations apply to a clean DB.

## Style

- Prefer plain, readable code over clever abstractions.
- Record material architecture choices as ADRs in `docs/adr/NNNN-title.md` (context, decision, consequences).
- No new dependencies without saying why in the plan.

## Repository layout

```
/apps/web            Next.js app: UI, /api/v1 route handlers, /admin
/packages/domain     Entities, services, state machines, ports (interfaces)
/packages/db         Drizzle schema, migrations, repositories
/packages/contracts  Request and response schemas, OpenAPI generation
/packages/adapters   Provider implementations (flight data, email, push, storage, auth)
/packages/config     Shared lint, TS and env config
/docs                PRD, build plan, ADRs, API docs, UX, open questions
/tests/e2e           End-to-end tests
```

## Commands

Requires Node 22+ and pnpm 10 (`corepack enable`).

```
pnpm install         Install all workspace dependencies
pnpm dev             Next.js dev server (pnpm --filter @flightmates/web dev)
pnpm lint            ESLint across the repo
pnpm typecheck       tsc --noEmit in every package
pnpm format          Prettier write
pnpm format:check    Prettier check (CI)
pnpm test            Vitest: packages/*/src/**/*.test.ts and apps/*/src/**/*.test.{ts,tsx}
pnpm build           Build every package that has a build step (Next.js app)
pnpm db:generate     Generate a SQL migration from packages/db/src/schema.ts
pnpm db:check        Check migration files are consistent
pnpm db:migrate      Apply migrations to DATABASE_URL
```

CI (`.github/workflows/ci.yml`) runs install, format:check, lint, typecheck, db:check, db:migrate on a clean Postgres 17, test and build on every PR.

Integration tests need `DATABASE_URL` pointing at a Postgres server where the user can create databases; each test file creates and drops its own database. Without `DATABASE_URL` they are skipped locally and fail in CI.

New tables: add them to `schema.ts`, run `pnpm db:generate`, and add `ENABLE ROW LEVEL SECURITY` for each new table in a migration (ADR 0002). A test fails if any public table lacks RLS.

Domain test doubles (fake auth provider, in-memory repositories, fixed clock) live in `@flightmates/domain/testing`. Use them in unit tests; use real Postgres for repository integration tests.

Per-environment Supabase settings: `docs/runbooks/supabase-auth.md`.

Added by later tickets: `pnpm test:e2e`, `pnpm db:seed`.
