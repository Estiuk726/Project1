# FlightMates build plan

Each ticket is sized for one Claude Code session. Do them in order. A ticket is done when it meets the definition of done in `CLAUDE.md` and its own acceptance criteria.

Prompt template for every ticket:

> Read CLAUDE.md and PRD sections [X, Y]. We are doing ticket [ID]. Post your plan first: files, schema changes, endpoints, tests. Do not write code until I approve the plan.

Status legend: ✅ done · 🟡 in progress · ⬜ not started

---

## Phase 0: Definition (documents only, no app code)

You review every output by hand before Phase 1.

| ID   | Status | Task                                                                                                                                                                      | Output                                                                     |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| P0-1 | 🟡     | Answer founder decisions D1 to D11 in PRD Section 22, or accept defaults                                                                                                  | D1, D7 decided in PRD v0.3                                                 |
| P0-2 | ⬜     | Test 2 to 3 flight data providers: look up 20 real market flights (at least 4 per origin country, plus hub legs) 1, 30, 90 and 180 days ahead; check codeshares and terms | `docs/adr/0001-flight-data-provider.md` with results table                 |
| P0-3 | ⬜     | Stack ADRs: auth, hosting and region, realtime, jobs, rate limiting                                                                                                       | `docs/adr/0002` to `0006`                                                  |
| P0-4 | ⬜     | Full schema and ERD from PRD Section 15                                                                                                                                   | `docs/architecture/schema.md` + Mermaid ERD                                |
| P0-5 | ⬜     | OpenAPI contracts from PRD Section 16                                                                                                                                     | `docs/api/openapi.yaml`                                                    |
| P0-6 | 🟡     | UX for the screen inventory in PRD 7.3                                                                                                                                    | Core flow canvas + `docs/ux/design-system.md` done; remaining screens open |
| P0-7 | ⬜     | Start legal review with the list in PRD 11.1                                                                                                                              | Named reviewer, draft privacy notice                                       |

Claude Code can draft P0-3, P0-4 and P0-5. Ask it to list assumptions at the top of each file.

---

## Phase 1: Foundation

| ID    | Status | Ticket                                                                                                                             | Acceptance                                                |
| ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| F-01  | ✅     | Monorepo with the layout in CLAUDE.md, pnpm workspaces, TypeScript strict, lint, format                                            | `pnpm lint` and `pnpm typecheck` pass on empty packages   |
| F-02  | ✅     | CI pipeline: lint, typecheck, test, build. Scaffold `apps/web` as a Next.js app (open question Q5)                                 | Runs on every PR, blocks merge on failure                 |
| F-03  | ✅     | Postgres + Drizzle, first migration (users, user_profiles), clean-DB migration check in CI                                         | Fresh DB builds from migrations in CI                     |
| F-04  | ✅     | Env config with validation, `.env.example`, secret handling                                                                        | App refuses to start with missing env vars                |
| F-05  | ✅     | Auth provider integration behind `AuthProvider` port; signup with DOB and 18+ check; email verification by 6-digit code and resend | Under-18 signup rejected (test); unverified user flagged  |
| F-05b | ✅     | Login, logout, session cookies, `GET /api/v1/me`, "log out other devices" (PRD 9.1)                                                | Session survives reload; revoked sessions rejected (test) |
| F-06  | 🟡     | Error shape, request validation middleware, structured logger that redacts sensitive fields, error tracking                        | Test: logs contain no email or message body               |
| F-07  | ⬜     | Staging deployment in EU region                                                                                                    | Staging URL works end to end with auth                    |

---

## Phase 2: Vertical slice

Goal: two real users on the same flight can find each other and chat. Ugly UI is fine; follow the design tokens where it costs nothing.

| ID   | Status | Ticket                                                                                                                                                                   | Acceptance                                                                           |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| S-01 | ⬜     | Countries, airports and airlines reference data with country and IANA time zones; `launch_markets` for BD, IN, PK, NP, LK (origin) and Europe (destination); seed script | Seed loads market airports, hubs and carriers                                        |
| S-02 | ⬜     | `flight_instances` with identity key (PRD 12.3), `FlightDataProvider` port, one adapter, lookup endpoint with caching                                                    | Same flight looked up twice hits provider once; after-midnight time zone test passes |
| S-03 | ⬜     | Manual flight entry fallback                                                                                                                                             | Manual flight stored as `user_reported`                                              |
| S-04 | ⬜     | Minimal profile: display name, photo upload with EXIF strip, home country, languages                                                                                     | Uploaded photo has no EXIF (test)                                                    |
| S-05 | ⬜     | Add flight as a single-segment trip with the visibility switch; create `flight_participants`                                                                             | Participation created in one transaction                                             |
| S-06 | ⬜     | Discovery section 1 only (same flight) with eligibility filters from PRD 13.1                                                                                            | Hidden, unverified, suspended users never returned (tests)                           |
| S-07 | ⬜     | Connection requests: create, accept, decline, withdraw, expiry job; state machine in domain                                                                              | All transitions in PRD 8.2 tested, including illegal ones                            |
| S-08 | ⬜     | Conversations and messages: send with client_message_id, paginated history                                                                                               | Retry does not duplicate; non-connections get 403                                    |
| S-09 | ⬜     | Basic block: hides both ways, cancels requests, closes conversation                                                                                                      | Block test across discovery, profile, requests, messages                             |
| S-10 | ⬜     | E2E test: signup → add trip → discover → request → accept → message → reload history                                                                                     | Runs in CI                                                                           |

Stop here and use it with 5 to 10 real people before Phase 3.

---

## Phase 3: Core depth

| ID   | Status | Ticket                                                                                            |
| ---- | ------ | ------------------------------------------------------------------------------------------------- |
| C-01 | ⬜     | Multi-segment trips, segment ordering rules, edit in one transaction                              |
| C-02 | ⬜     | Codeshare resolution                                                                              |
| C-03 | ⬜     | Full profile fields and visibility toggles from PRD 9.2; API test that hidden fields never appear |
| C-04 | ⬜     | The 7 core screens built to `docs/ux/design-system.md` (tab bar, ticket cards, glass action bar)  |
| C-05 | ⬜     | Discovery sections 2 and 3, `ranking_v1`, reason labels, ranking version in analytics             |
| C-06 | ⬜     | Zero-match state and "notify me when someone joins"                                               |
| C-07 | ⬜     | Flight invite links: public page with flight data only, revoke                                    |
| C-08 | ⬜     | Realtime signal channel per user; client refetches from API                                       |
| C-09 | ⬜     | Notifications: in-app list, email digest, PWA web push with iOS Home Screen guidance, preferences |
| C-10 | ⬜     | Request note (150 chars, no links), 30-day cooldown, remove connection                            |

---

## Phase 4: Safety and admin

| ID   | Status | Ticket                                                                          |
| ---- | ------ | ------------------------------------------------------------------------------- |
| A-01 | ⬜     | Report flow with reasons, message context attachment, combined report and block |
| A-02 | ⬜     | Moderation cases, auto-restriction at 3 reports in 7 days                       |
| A-03 | ⬜     | Admin roles, user search, case review, actions with required reason             |
| A-04 | ⬜     | Append-only audit log for all admin actions                                     |
| A-05 | ⬜     | Abuse limits from PRD 10.3 and rate limits from PRD 17                          |
| A-06 | ⬜     | Meetup guidance and community guidelines page                                   |
| A-07 | ⬜     | Account deletion with retention rules (PRD 11.3), data export                   |

---

## Phase 5: Closed beta

| ID   | Status | Task                                                                                                       |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------- |
| B-01 | ⬜     | Analytics events for the full funnel (PRD 18.1); dashboard for KPIs in 18.2, broken down by origin country |
| B-02 | ⬜     | Security review: OWASP checklist, IDOR sweep of every endpoint, dependency scan                            |
| B-03 | ⬜     | Load test discovery and messaging                                                                          |
| B-04 | ⬜     | Seed the market per origin country, recruit 200+ beta users per country, run moderation rota               |
| B-05 | ⬜     | Check density gate per origin country (PRD 5.6) before opening that country                                |

---

## Phase 6 onwards

University verification and "Same university" section, boarding pass verification, flight status sync and disruption flow (PRD 6, P1), then growth work from PRD 20.
