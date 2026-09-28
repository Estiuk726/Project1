# Error tracking (Sentry, EU)

ADR 0004. One Sentry project per environment is not needed: use one project and set `SENTRY_ENVIRONMENT`.

## Set up (once)

1. Create the Sentry organization with **data storage location: EU (Frankfurt)**. The region cannot be changed later.
2. Create a project with platform **Node.js**.
3. In **Project Settings > Security & Privacy**:
   - turn on **Data Scrubber** and **Use Default Scrubbers**
   - turn off **Store IP Addresses**
4. Copy the DSN from **Project Settings > Client Keys (DSN)**. Its host must end in `.de.sentry.io`; the app refuses to start with any other region.

## Per environment

| Variable             | Local   | Staging   | Production   |
| -------------------- | ------- | --------- | ------------ |
| `SENTRY_DSN`         | empty   | the DSN   | the DSN      |
| `SENTRY_ENVIRONMENT` | `local` | `staging` | `production` |

Set them in the hosting provider's environment settings, never in the repository.

## Check it works (staging)

1. Make a request that fails with a 500, for example with Supabase temporarily unreachable.
2. Copy the `x-request-id` response header.
3. In Sentry, search issues by `request_id:<that id>`. The event shows the error type and stack, with no message, request data or user data.
4. Search the logs for the same ID to see the `request.failed` line.
