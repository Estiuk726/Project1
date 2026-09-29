# Staging environment

ADR 0005 (hosting), ADR 0002 (database), ADR 0003 (auth), ADR 0004 (error tracking).

Staging = Supabase project in Frankfurt + Vercel project `flightmates-staging` with functions in `fra1`. Deploys run from `.github/workflows/deploy-staging.yml` after CI passes on `main`. Until the secrets below exist, that workflow skips with a notice.

## 1. Supabase (staging project)

1. Check the project region is **Central EU (Frankfurt)**: Project Settings > General.
2. Apply the Auth settings in `docs/runbooks/supabase-auth.md` (email confirmation on, 6-digit OTP, confirmation template with `{{ .Token }}`, JWT expiry 600 s, refresh token rotation on).
3. Collect, from Project Settings:
   - **API:** Project URL, `anon` key, `service_role` key.
   - **Database > Connection string:**
     - **Transaction pooler** (port 6543): for the app.
     - **Session pooler** (port 5432): for migrations.

## 2. Vercel

1. Create a Vercel account and a project named `flightmates-staging`, imported from this GitHub repository.
2. Project Settings > General:
   - **Root Directory:** `apps/web`.
   - **Framework:** Next.js.
   - Leave the build and install commands on their defaults. pnpm is detected from the lockfile.
3. Automatic Git deployments are off in `apps/web/vercel.json` (`git.deploymentEnabled: false`). GitHub Actions deploys instead, so migrations run first.
4. Project Settings > Environment Variables, for the **Production** environment of this project:

| Variable                    | Value                                  |
| --------------------------- | -------------------------------------- |
| `DATABASE_URL`              | Supabase transaction pooler URL (6543) |
| `SUPABASE_URL`              | Supabase project URL                   |
| `SUPABASE_ANON_KEY`         | `anon` key                             |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key                     |
| `SENTRY_DSN`                | optional, EU DSN (`error-tracking.md`) |
| `SENTRY_ENVIRONMENT`        | `staging`                              |

5. Create an access token (Account Settings > Tokens) scoped to the team that owns the project.
6. Find the org and project IDs in Project Settings > General (or `.vercel/project.json` after `vercel link`).

## 3. GitHub

Repository Settings > Environments > `staging` (created on the first workflow run, or create it now):

| Kind     | Name                   | Value                                                             |
| -------- | ---------------------- | ----------------------------------------------------------------- |
| Secret   | `VERCEL_TOKEN`         | the Vercel access token                                           |
| Secret   | `VERCEL_ORG_ID`        | Vercel team or user ID                                            |
| Secret   | `VERCEL_PROJECT_ID`    | `flightmates-staging` project ID                                  |
| Secret   | `STAGING_DATABASE_URL` | Supabase **session pooler** URL (5432)                            |
| Variable | `STAGING_URL`          | the staging domain, e.g. `https://flightmates-staging.vercel.app` |

Set `STAGING_URL` to the project's production domain. The per-deployment URLs are behind Vercel's deployment protection, so the smoke test would get Vercel's login page instead of the app.

## 4. Deploy and check

1. Actions > Deploy staging > Run workflow (or merge to `main`).
2. The workflow applies migrations, deploys, and runs `pnpm smoke:auth $STAGING_URL`:
   - `/me` without a session returns 401 with a request ID.
   - A cross-site login returns 403.
3. **End-to-end with auth** (F-07 acceptance), from your machine, using an inbox you can read:

   ```
   pnpm smoke:auth https://flightmates-staging.vercel.app --signup you+smoke1@example.com
   ```

   It signs up with a random password, asks for the emailed code, verifies, calls `/me`, logs in, logs out, and checks the old session is rejected. Use a new `+tag` address each run, and delete the test users in Supabase afterwards.

4. Check the Vercel function logs show one JSON `request.completed` line per request and no emails or tokens.

## Rollback

- **App:** Vercel > Deployments > pick the previous deployment > Promote to Production.
- **Migrations are forward-only:** fix with a new migration.
