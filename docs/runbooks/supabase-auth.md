# Supabase Auth setup (per environment)

ADR 0003. Do this for each Supabase project (staging, production) before the signup flow is used there. None of it is needed for local tests or CI, which use an in-memory auth provider.

## 1. Keys

Project Settings → API. Copy into the environment's secrets (never into the repo):

| Variable                    | Where                                   |
| --------------------------- | --------------------------------------- |
| `SUPABASE_URL`              | Project URL                             |
| `SUPABASE_ANON_KEY`         | `anon` public key                       |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` secret key (server only) |

## 2. Email signups with a 6-digit code

Authentication → Sign In / Providers → Email:

- Enable email provider: **on**
- Confirm email: **on**
- Minimum password length: **8** (matches `signupRequestSchema`)
- Email OTP length: **6**

## 3. Confirmation email sends the code, not a link

Authentication → Emails → Templates → **Confirm signup**. Replace the body so it shows the code:

```html
<h2>Your FlightMates code</h2>
<p>Enter this code to confirm your email:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
<p>It expires soon. If you did not sign up, ignore this email.</p>
```

Do not include `{{ .ConfirmationURL }}`; the app verifies with `POST /api/v1/auth/verify-email`.

## 4. Sending email

The built-in Supabase mailer is rate limited and meant for testing. Before beta, set a custom SMTP provider (Authentication → Emails → SMTP Settings) with an EU region where possible, and add it to the processor list (PRD 11.1).

## 5. Check

Sign up with a real inbox on staging, receive a 6-digit code, verify it, and confirm `users.email_verified_at` is set.
