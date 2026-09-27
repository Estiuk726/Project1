# Open questions

Questions where the PRD is ambiguous or silent. Add new ones at the bottom with the date, the section, and the ticket that is blocked. Move answered ones to "Answered" with the answer.

## Open

| #   | Date       | PRD section | Question                                                                                                                                                                                                                                                                                | Blocks |
| --- | ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Q1  | 2026-09-27 | 8.2         | Does the 30-day cooldown also apply after the sender **withdraws** a request, or only after decline and expiry?                                                                                                                                                                         | S-07   |
| Q2  | 2026-09-27 | 11.3, 9.1   | When one participant deletes their account, does the other participant still see the conversation (read-only) during the 30 days before removal, or does it disappear immediately?                                                                                                      | A-07   |
| Q3  | 2026-09-27 | 5.3         | Section 3 ("To {city}") uses the final destination **city**. Should cities be normalized to a reference list (e.g. a `cities` table derived from airports) so "Berlin" from BER and a typed "Berlin" match? Proposed: derive from the last segment's destination airport, no free text. | C-05   |
| Q4  | 2026-09-27 | 5.1         | For return trips (Europe → South Asia), is the trip in market if the final destination is in an origin country? Assumed yes in 5.1. Confirm.                                                                                                                                            | C-05   |
| Q5  | 2026-09-27 | 14.1        | The Next.js app scaffold is not assigned to a ticket. Proposed: scaffold `apps/web` as a Next.js app in F-02 so CI can run `pnpm build` on it.                                                                                                                                          | F-02   |

## Answered

| #   | Question                    | Answer                                 | Where recorded |
| --- | --------------------------- | -------------------------------------- | -------------- |
| —   | Launch market (D1)          | South Asia ↔ Europe                    | PRD 5.1        |
| —   | Wider matching default (D7) | Merged into one trip visibility switch | PRD 10.2       |
