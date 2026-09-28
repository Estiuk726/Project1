# Open questions

Questions where the PRD is ambiguous or silent. Add new ones at the bottom with the date, the section, and the ticket that is blocked. Move answered ones to "Answered" with the answer.

## Open

| #   | Date       | PRD section | Question                                                                                                                                                                                                                                                                                | Blocks |
| --- | ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Q1  | 2026-09-27 | 8.2         | Does the 30-day cooldown also apply after the sender **withdraws** a request, or only after decline and expiry?                                                                                                                                                                         | S-07   |
| Q2  | 2026-09-27 | 11.3, 9.1   | When one participant deletes their account, does the other participant still see the conversation (read-only) during the 30 days before removal, or does it disappear immediately?                                                                                                      | A-07   |
| Q3  | 2026-09-27 | 5.3         | Section 3 ("To {city}") uses the final destination **city**. Should cities be normalized to a reference list (e.g. a `cities` table derived from airports) so "Berlin" from BER and a typed "Berlin" match? Proposed: derive from the last segment's destination airport, no free text. | C-05   |
| Q4  | 2026-09-27 | 5.1         | For return trips (Europe → South Asia), is the trip in market if the final destination is in an origin country? Assumed yes in 5.1. Confirm.                                                                                                                                            | C-05   |
| Q9  | 2026-09-28 | 9.1, 10.5   | Can suspended or banned users still log in (and see a notice), or is login refused? F-05b does not check `users.status` at login.                                                                                                                                                       | A-03   |

## Answered

| #   | Question                                                   | Answer                                                                     | Where recorded                             |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| —   | Launch market (D1)                                         | South Asia ↔ Europe                                                        | PRD 5.1                                    |
| —   | Wider matching default (D7)                                | Merged into one trip visibility switch                                     | PRD 10.2                                   |
| Q5  | Which ticket scaffolds the Next.js app?                    | F-02 (`apps/web`, Next.js 16, App Router)                                  | BUILD_PLAN F-02                            |
| Q6  | Signup with an already-registered email: reveal it or not? | Same response as a new signup ("check your email"); no account enumeration | F-05                                       |
| Q7  | When does someone born on 29 February turn 18?             | 1 March in non-leap years                                                  | F-05 (`isAdult`)                           |
| Q8  | How long does a login last?                                | 30 days, renewed while the app is used; access tokens last 10 minutes      | F-05b (`SESSION_MAX_AGE_SECONDS`, runbook) |
