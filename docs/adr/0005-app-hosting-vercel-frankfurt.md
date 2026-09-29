# ADR 0005: App hosting on Vercel, functions in Frankfurt

- Status: Accepted
- Date: 2026-09-29
- Decides: PRD Section 22, D4 (app hosting part; the database part is ADR 0002), ticket F-07

## Context

PRD 14.1 asks for managed hosting in an EU region, one deployable Next.js app, and no self-managed servers in the MVP. The database and auth run on Supabase in Frankfurt (eu-central-1, ADRs 0002 and 0003). Every API request makes one or more database round trips, so the app should run in the same city as the database. The founder asked for whichever option is best.

## Decision

- Host `apps/web` on **Vercel**, with server functions pinned to **Frankfurt (`fra1`)** in `apps/web/vercel.json`. Static assets are served from Vercel's CDN.
- **One Vercel project per environment.** `flightmates-staging` now and `flightmates-production` later, each with its own environment variables and Supabase project. For each project, its Vercel "production" deployment is that environment.
- **Deploys run from GitHub Actions** (`.github/workflows/deploy-staging.yml`), not Vercel's Git integration, so the order is fixed:
  1. CI passes on `main`.
  2. Migrations are applied to the staging database.
  3. The app is built and deployed with the Vercel CLI.
  4. The smoke test runs against the staging URL.
- **Database connections:**
  - The running app uses the Supabase transaction pooler (port 6543), with prepared statements off.
  - Migrations use the session pooler (port 5432), because GitHub runners have no IPv6 for the direct connection.
- **Error reports are flushed before a 500 response is returned** (`ErrorTracker.flush`, at most 2 seconds), because a serverless function can be frozen as soon as it responds. This resolves the open point in ADR 0004.

## Alternatives considered

- **Fly.io (Frankfurt):** long-running Node server, no cold starts, but we would manage the Dockerfile, machine sizing and scaling.
- **Cloud Run (europe-west3, Frankfurt):** similar trade-off, with more setup (container registry, IAM).
- **Netlify:** fewer EU region controls for functions.

Vercel is the reference platform for Next.js, needs no container or server management, and pins functions to Frankfurt with one setting.

## Consequences

- Vercel is a processor in the PRD 11.1 list. Request logs pass through Vercel; our logs are redacted JSON (F-06).
- Serverless functions have cold starts. Acceptable for the MVP; revisit if p95 latency suffers.
- Realtime (D5) cannot use long-lived connections from our functions; this matches the PRD's plan to use a managed realtime service as a signal only.
- Moving off Vercel means a Dockerfile and a new deploy job; the app code does not change.
