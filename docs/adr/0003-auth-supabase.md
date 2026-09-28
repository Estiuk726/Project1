# ADR 0003: Authentication with Supabase Auth

- Status: Accepted
- Date: 2026-09-28
- Decides: PRD Section 22, D3 (auth provider)

## Context

PRD 9.1 needs email and password signup, email verification by 6-digit code, password reset, revocable sessions and account deletion, without building password handling ourselves. PRD 14.2 requires third-party services behind interfaces in `packages/domain/ports`. The database already runs on Supabase in Frankfurt (ADR 0002).

## Decision

- Use **Supabase Auth** in the same Supabase project (Frankfurt, eu-central-1).
- Access it only through an `AuthProvider` port in `packages/domain/ports`; the Supabase implementation lives in `packages/adapters`. Domain code never sees Supabase types.
- Our `users` table stays the source of truth for app data. It links to the Supabase user through `users.auth_provider_id` (plain text, not a foreign key to `auth.users`), so the provider can be replaced.
- Email verification uses Supabase's 6-digit email OTP (the confirmation email template sends `{{ .Token }}`, not a link).
- The 18+ check and all other signup rules run in our domain layer before the auth user is created.
- The service role key is server-only and never sent to the browser.

## Consequences

- One vendor covers database and auth; fewer accounts and processors to manage (PRD 11.1 processor list).
- Supabase dashboard settings (email template, OTP length, rate limits, redirect URLs) are configuration we must document and apply per environment (F-07).
- Tests use an in-memory `AuthProvider`; the Supabase adapter is exercised against a real project in staging.
- Replacing Supabase Auth later means a new adapter plus a user migration, but no domain changes.
