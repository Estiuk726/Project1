# FlightMates: PRD + Technical Requirements v0.3

Status: Draft for founder review
Supersedes: v0.2
Audience: founder, team, and coding agents (Claude Code)

Labels used in this document:

- **Decided**: build it this way.
- **Proposed default**: recommended answer, build it this way unless the founder changes it before the affected ticket starts.
- **Founder decision**: must be answered before the affected feature is built. Listed in Section 22.

---

## 0. What changed

### 0.1 v0.2 → v0.3

| Change | Why | Section |
|---|---|---|
| Launch market is South Asia → Europe (BD, IN, PK, NP, LK to any European airport), not one Dhaka → Budapest route | Founder decision D1. Students from several origins converge on the same Gulf/Istanbul hub legs, which is where density comes from | 4, 5.1, 5.6 |
| Density gate measured per origin country | A strong country must not hide an empty one | 5.6 |
| Discovery tiers reduced from 5 to 3 user-facing sections | Simpler to explain and build: "On your flights", "Same route", "To {city}" | 5.3, 9.5, 13 |
| One visibility switch per trip ("Show me to other travellers") replaces separate flight and wider-matching toggles | Simpler flow; one decision for the user | 8.4, 10.2, 15 |
| University verification and tier moved from P0 to P1 | Europe-wide university list is large; not needed to prove the core loop | 6, 9.2, 10.1 |
| Requests live inside the Chats tab; app has 3 tabs (Trips, Chats, Me) | Fewer screens | 7 |
| Email verification uses a 6-digit code | Easier on mobile than a link | 9.1 |
| UI direction defined, 7-screen core flow | Founder-provided references | 7, 24, `docs/ux/design-system.md` |

### 0.2 v0.1 → v0.2

| v0.1 issue | Fix in v0.2 | Section |
|---|---|---|
| Cold start: empty flights at launch | Launch market, fallback discovery tiers, zero-match state, flight invite links, density gate before public launch | 5, 13 |
| "Verified users" promised but verification TBD; anyone can add any flight | Verification levels, flight-add limits, badges, request permissions tied to verification | 10 |
| Safety defaults undecided | 18+ only, per-trip visibility, fixed public profile fields, request controls, meetup guidance, moderation SLA, auto-restrictions | 10 |
| Overview and PRD disagreed (age, location, university, import, meetups) | One reconciled field list and feature list | 7, 9.2, 6 |
| Flight data: no provider, three adapters, UTC-only dates | Evaluation criteria, one adapter, local-date identity key, manual fallback, disruption handling | 12 |
| Scope too large for a first build | Thin vertical slice first, managed services, one deployable app, reduced P0 | 6, 14, 20 |
| No push plan | PWA web push in P0, native apps later | 9.8 |
| D7/D30 retention wrong for infrequent flyers | Journey-level retention and pre-flight engagement metrics | 18 |
| Missing state machines, screens, limits, cancelled-flight behavior | Added | 7, 8, 12.6, 17 |
| Spec not usable by Claude Code as a PDF | Markdown in repo, CLAUDE.md, BUILD_PLAN.md with small tickets | 20, repo root |
| GDPR left to "before launch" | Moved to Phase 0 because it shapes the schema; retention table added | 11 |

---

## 1. Summary

FlightMates is a social travel platform that connects people travelling on the same flight or the same journey. The immediate question it answers: **"Who else is travelling with me?"**

The flight is the context. The passengers become the network.

**North Star metric:** Connected journeys per week, meaning journeys where the traveler has at least one accepted connection with someone who shares a segment, route, or destination.

**MVP must prove:** when a traveler in the launch market adds a journey, FlightMates reliably shows them relevant people and they safely connect and talk before travelling.

---

## 2. Product principles

- **Journey-first.** Flights and journeys are the core objects.
- **Density before breadth.** One market done well beats global coverage done thinly.
- **Simple flow.** The whole MVP fits in 7 screens and 3 tabs. Every extra screen or setting needs a reason.
- **Consent-first.** Users control visibility and who can contact them.
- **Safety defaults beat growth.** When a default trades safety for engagement, choose safety.
- **Minimum exposure.** Show the least data needed for a useful first impression.
- **API-first.** Business rules live in the backend, never the UI.
- **Replaceable providers.** Flight data, auth, email, push, and realtime sit behind interfaces.
- **Migration discipline.** Every schema change is a versioned migration.
- **Measure the loop.** Flight added, traveler discovered, request, connection, conversation.

---

## 3. Positioning

FlightMates is a social network where real-world travel creates the context for connection.

It is not a dating app, not a public travel forum, not an airport chatroom, and not a booking platform. Product decisions that push toward any of these (swiping, public feeds, open group chats, booking flows) are out of scope for MVP.

---

## 4. Target users

**MVP primary user (Decided):** international students travelling between South Asia (Bangladesh, India, Pakistan, Nepal, Sri Lanka) and their university city in Europe.

Why: they fly on predictable dates (term start and end, holidays), cluster on the same connecting flights through Gulf and Istanbul hubs, share a strong context (moving to study abroad, often the same city), and are reachable through student associations and scholarship communities. This gives the density the product needs.

Later segments (not designed for in MVP): frequent travelers, solo leisure travelers, business travelers, groups and families.

---

## 5. Launch strategy and cold start

### 5.1 Launch market (Decided)

**South Asia → Europe, both directions.**

- **Origin countries:** Bangladesh (BD), India (IN), Pakistan (PK), Nepal (NP), Sri Lanka (LK).
- **Destination region:** Europe: EU and EEA countries, United Kingdom, Switzerland.
- **Connecting hubs:** any. The common ones (Doha DOH, Dubai DXB, Abu Dhabi AUH, Istanbul IST, Jeddah JED, Muscat MCT, Bahrain BAH, Kuwait KWI) are seeded as reference data first.

A journey is **in market** when its first origin is in an origin country and its final destination is in the destination region, or the reverse (returning home).

Why this works for density: a student from Dhaka, one from Delhi and one from Lahore often end up on the **same** Doha → Berlin leg. Segment-level matching (13) finds them even though their first flights differ.

The market is configuration, not code: a `launch_markets` table lists enabled countries with a role (`origin`, `destination`), and `airports` carries the country. Users outside the market can sign up and add flights; they see a clear message that coverage is limited on their route.

### 5.2 Seeding plan

- Launch around peak travel windows: European autumn intake (August to October), January intake, summer and winter holidays, Eid and Diwali periods.
- Partner with student associations, scholarship communities (e.g. Stipendium Hungaricum, DAAD, Erasmus Mundus alumni groups), education agents and university international offices.
- Recruit a closed beta of at least 200 users per origin country that will be opened, starting with the two countries that seed fastest.

### 5.3 Discovery sections (Decided)

Discovery for a trip shows three sections. Each result carries a reason label.

| # | Section title | Who appears | Internal tier |
|---|---|---|---|
| 1 | "On your flights" | Same flight instance as any segment of the viewer's trip | `same_flight` |
| 2 | "Same route" | Same origin and destination airport on any segment, departing within ±3 days (local date), not already in section 1 | `same_route` |
| 3 | "To {final destination city}" | Same final destination city, arriving within ±7 days, not already in sections 1 or 2 | `same_destination` |

- Only travellers whose trip visibility is on (10.2) appear in any section.
- The university section from v0.2 is P1 (Section 6).

### 5.4 Zero-match state (Decided)

When no section returns anyone, the screen must not look broken. It shows:

- "You're the first FlightMate on QR 639 on 14 Oct."
- A toggle, on by default: "Notify me when someone joins this flight."
- An invite action (5.5).

If section 1 is empty but sections 2 or 3 have people, section 1 shows the same message in compact form and the other sections are shown normally.

### 5.5 Flight invite links (Decided)

A user can share a link like `flightmates.app/f/<token>` to their flight. The public page shows only flight number, route, date and "Join FlightMates to see who's travelling." It never shows any participant data. Opening the link after signup pre-fills the flight. The token is random and revocable; it identifies the flight instance, not the inviting user publicly.

### 5.6 Density gate (Decided)

Public launch in an origin country requires, during closed beta for that country: at least 40% of added in-market trips have one or more visible travellers across the three sections. Measured **per origin country**. Below that, keep seeding that country instead of opening it.

---

## 6. MVP scope

### P0 (the first public release)

- Email signup and login, email verification by 6-digit code, password reset, sessions, account deletion (managed auth provider).
- 18+ gate at signup.
- Profile with the fixed field list (9.2).
- Flight lookup by flight number and date, with manual fallback.
- Trips (journeys) with ordered segments.
- One visibility switch per trip.
- Discovery with 3 sections, eligibility filters and reason labels.
- Connection requests with optional short note, accept, decline, withdraw, remove.
- 1:1 text messaging between connections, with history.
- In-app, email and PWA web push notifications.
- Block, report, moderation queue, suspend and restore.
- Flight invite links.
- Minimal admin: user search, reports queue, actions, audit log.
- Analytics events to a product analytics tool.

### P1 (after closed beta, before or shortly after public launch)

- University email verification, badge and a "Same university" discovery section.
- Boarding pass scan for flight verification (10.1).
- Flight status sync with delay and cancellation notifications.
- Admin flight-data anomaly view.
- Trip templates ("returning home", "heading back to uni").
- Destination photos on trip cards (see 24).

### Out of MVP

- Booking import by email forwarding or inbox access.
- Images, voice or files in chat.
- Group chats and flight communities.
- Live location sharing and in-app meetup scheduling.
- Native iOS and Android apps (PWA first).
- Booking, marketplace, ads, loyalty, tokens, gamification, AI assistant.
- Mandatory government ID verification.

---

## 7. Core flow and screens

### 7.1 The core flow (Decided)

The whole MVP is 7 screens. The reference design is the FlightMates Core Flow canvas; tokens and components are in `docs/ux/design-system.md`.

| # | Screen | What happens |
|---|---|---|
| 1 | Create account | First name, email, date of birth, password. Under 18 is refused. A 6-digit code is emailed to confirm. |
| 2 | Your profile | Photo, home country, languages. Nothing else required. |
| 3 | Add your trip | Flight number + date → flight card appears. Optional connecting flight(s). One switch: "Show me to other travellers" (default on). |
| 4 | Who's travelling | Trip header with route. Filter pills for the 3 sections with counts. People as ticket cards with reason labels. |
| 5 | Say hi | Traveller profile, why you see them, optional note (150 chars), Say hi. Block and Report on the same screen. |
| 6 | Chats | Incoming requests at the top with Accept / Not now. Conversations below, each labelled with its flight. |
| 7 | Chat | Text messages, one-time meeting-safety tip, report/block in the menu. |

Navigation: 3 tabs, **Trips, Chats, Me**. A bell in the header opens the in-app notification list. Push notifications deep-link to the request or conversation.

### 7.2 User journeys

**New user:** Sign up (18+ check) → enter email code → minimal profile (photo, country, languages) → add trip → who's travelling → say hi → accepted → chat.

Profile completion beyond the minimum (bio, interests) is prompted later, not blocking. A photo is required to send a request, not to browse.

**Returning user:** Open → Trips tab shows next trip with count of FlightMates → Chats tab shows requests and conversations.

**Safety:** From any profile or conversation → block or report → immediate restriction → moderation case → admin action → reporter notified of outcome category.

**Multi-segment:** Add first flight → add connecting flight(s) → discovery matches per segment, plus route and destination.

**Disruption (P1):** Flight cancelled → notification → trip marked disrupted → user adds replacement flight → connections kept.

### 7.3 Screen inventory (MVP)

Public: landing, flight invite page, login, signup, enter email code, reset password, privacy notice, terms, community guidelines.

App: the 7 core screens (7.1), plus: notification list (sheet from the bell), trip settings (visibility, remove a flight, delete trip), my profile edit, settings (account, notifications, request policy, blocked users, delete account, data export), report flow, zero-match state, manual flight entry.

Admin: user search, user detail, reports queue, case detail, audit log.

---

## 8. Core objects and state machines

### 8.1 Objects

- **User:** account and identity. Stable UUID independent of email.
- **Profile:** what others see.
- **Verification:** email, university email (P1), boarding pass (P1) records.
- **Airport, Airline:** reference data. Airports carry country and IANA time zone.
- **Flight Instance:** one dated operated flight (see 12.3 for its identity key).
- **Codeshare:** marketing flight number that maps to an operated instance.
- **Journey (Trip in the UI):** one trip owned by one user.
- **Journey Segment:** ordered position of a flight instance in a journey.
- **Flight Participant:** a user on a flight instance.
- **Connection Request:** directional, with state.
- **Connection:** mutual relationship.
- **Conversation, Message:** 1:1 chat belonging to a connection.
- **Block, Report, Moderation Case, Moderation Action.**
- **Notification, Push Subscription.**

### 8.2 Connection request states (Decided)

```
pending ──accept──▶ accepted (creates Connection + Conversation)
pending ──decline─▶ declined
pending ──withdraw▶ withdrawn
pending ──timeout─▶ expired   (14 days, or 48h after the context flight lands, whichever first)
any     ──block───▶ cancelled (by system)
```

- Only one pending request per ordered pair.
- Declines are silent: the sender sees the request as expired when it times out. "Not now" in the UI is decline.
- After decline or expiry, the sender cannot request the same user again for 30 days.
- The optional note is plain text, max 150 characters, no links.

### 8.3 Connection states

`active` → `removed` (either side, silent) or `blocked` (either side). A removed connection closes the conversation for both. Either user may request again later, subject to the 30-day cooldown if the other side removed them.

### 8.4 Trip visibility (Decided)

- A journey has one `visible` flag, default `true`, set on the Add trip screen and changeable in trip settings.
- A user can hide one flight inside a visible trip from trip settings; this sets that participation to `hidden`.
- A participation is discoverable when the journey is visible **and** the participation is `visible`.
- Participation leaves discovery 48 hours after scheduled arrival. The user's connections are unaffected.

### 8.5 Flight instance status

`scheduled`, `delayed`, `departed`, `landed`, `cancelled`, `diverted`, `unknown`. Source is `provider` or `user_reported`.

---

## 9. Functional requirements

### 9.1 Authentication and accounts

- Email and password via managed auth provider (ADR). Social login later.
- Date of birth at signup; under 18 cannot register. DOB is private.
- Email verification by 6-digit code, required before appearing in discovery or sending requests.
- Sessions revocable from settings ("log out other devices").
- Account deletion: immediate hide from discovery and chats, hard delete within 30 days per retention table (11.3).
- Data export: JSON of the user's own data, delivered by email link.

### 9.2 Profile fields (Decided: this is the reconciled list)

| Field | Required | Visible to other travelers before connecting | Notes |
|---|---|---|---|
| First name (display name) | Yes | Yes | No surname field in MVP |
| Photo | Yes to send requests | Yes | EXIF stripped, see 10.6 |
| Age | Derived from DOB | Optional, off by default | Shown as number if on |
| Home country | Yes | Yes | Country only, never city |
| Languages | Yes, 1+ | Yes | From list |
| Interests | No, up to 5 | Yes | From fixed list, no free text |
| Bio | No, max 300 chars | Yes | Moderated by report |
| University (P1) | No | Only if verified and toggled on | From university email |
| Travel purpose | Per journey | Yes | Study, work, holiday, visiting family, returning home, other |
| Final destination city | Per journey | Yes when the trip is visible | Needed for section 3 |

Never shown to other users: email, phone, DOB, surname, home city, other flights or segments not shared in the current context, seat number (never collected), social links (not supported in MVP).

Not collected in MVP: gender, religion, ethnicity, phone number.

### 9.3 Flights

- Look up by flight number plus departure date (local date at origin).
- Also search by origin, destination and date to pick from a list.
- If the provider has no data: manual entry of airline, flight number, origin, destination, scheduled departure local time. Marked `user_reported`. Merged into the provider instance when one appears.
- Codeshare numbers resolve to the operating instance, so users on QR and partner numbers meet on the same flight.

### 9.4 Journeys (Trips)

- A journey has 1 to 6 ordered segments.
- Segments must be chronological with at least 30 minutes between arrival and next departure (warning, not block, for manual entries).
- Journey has travel purpose, final destination city (defaults to the city of the last segment's destination airport) and the visibility flag.
- Editing segments updates participation in the same transaction.

### 9.5 Discovery

- Per journey, in the three sections of 5.3, shown as filter pills with counts.
- Each result shows the profile card (9.2), badges (10.1) and reason labels.
- No numeric scores shown.
- Eligibility filters from 13.1 apply before ranking.
- Paginated. Counts shown per section.

### 9.6 Connections

- Send, withdraw, accept, decline, remove, per 8.2 and 8.3.
- Request permission follows the recipient's setting (10.2).

### 9.7 Messaging

- Text only, max 2,000 characters per message.
- Only between active connections.
- Messages persisted before delivery is reported as sent.
- Client supplies a client message ID for idempotent retries.
- History paginated, newest first.
- Links shown as plain text with a warning in the first message from a new connection.
- Report and block reachable from the conversation header.

### 9.8 Notifications

- Events: request received, request accepted, new message, someone joined your flight, flight status change (P1).
- Channels: in-app (always), PWA web push (opt-in prompt after first trip added), email (digest for unread messages after 30 minutes, and requests).
- iOS web push requires the PWA to be added to the Home Screen; onboarding explains this on iOS.
- Per-channel settings per event type.
- Quiet by default for "someone joined your flight": max one per flight per 6 hours.

---

## 10. Trust, verification and safety

### 10.1 Verification levels (Decided)

| Level | How | Badge | Unlocks |
|---|---|---|---|
| Email verified (P0) | 6-digit code in email | none | Appear in discovery, send requests |
| University verified (P1) | Code sent to a university email domain from the `universities` table | "Verified student, {university}" | University field, "Same university" section |
| Flight verified (P1) | Scan boarding pass barcode (IATA BCBP) in the app; name and flight must match the claimed flight | "Boarding pass verified" | Badge on that flight |

Rules:

- Boarding pass images are not stored. Only the parse result (flight, date, match yes or no) is kept. Passenger name from the barcode is compared then discarded.
- Once any verified badge exists, users can filter discovery to verified travelers only.
- Flight claims are otherwise trusted, so limits apply (10.3).

### 10.2 Visibility and request controls (Decided)

- Per trip: one switch "Show me to other travellers", default on. It covers all three discovery sections.
- Per flight inside a trip: hide from trip settings (8.4).
- The visibility choice is shown on the Add trip screen, before discovery opens.
- Who can send me requests: everyone eligible (default), verified only (P1, once verification exists), nobody.

### 10.3 Abuse limits (Decided, values configurable)

- Max 8 future flight instances per user at once.
- Max 5 flights added per 7 days.
- Flights must depart within the next 330 days and not in the past.
- Accounts under 48 hours old: max 5 requests per day. Otherwise 20 per day.
- Max 30 pending outgoing requests at once.
- Messages: 30 per minute per user, 300 per day to users who have not replied.

These limits make it costly to add random flights to browse passenger lists.

### 10.4 Blocking and reporting

- Block is immediate and mutual in effect: neither side appears in the other's discovery, requests are cancelled, the connection and conversation close. The blocked user is not told.
- Report reasons: harassment, sexual content, spam or scam, fake profile, underage, threats or safety concern, other. Optional details. Reporting a message attaches that message and the 10 before it to the case.
- Report and block can be done together in one flow.

### 10.5 Moderation operations (Proposed defaults)

- During beta the founder or a named team member is on the moderation rota.
- Target: first review within 24 hours; "threats or safety concern" and "underage" within 4 hours during waking hours. With several origin time zones, the rota covers 07:00 to 23:00 in Asia/Dhaka and Europe/Berlin combined.
- Automatic restriction: 3 reports from distinct users within 7 days hides the account from discovery and blocks new requests until reviewed.
- Actions: dismiss, warn, restrict, suspend, ban, remove content. Every action requires a reason and writes to the immutable audit log.
- Reporter receives the outcome category (action taken or no violation), not details.
- Community guidelines page linked from signup and the report flow.

### 10.6 Media safety

- Photo uploads: JPEG, PNG or WebP, max 8 MB, re-encoded server-side, EXIF and GPS data stripped.
- One photo in MVP.

### 10.7 Meeting in person

MVP has no meetup feature. On the first conversation with a new connection, show one-time guidance: meet in public airside or terminal areas, tell someone your plans, cabin crew and airport staff can help. Links to community guidelines.

---

## 11. Privacy and legal

Moved to Phase 0 because the answers change the schema.

### 11.1 Before any real user data (Founder decision with legal review)

- Lawful basis per purpose. Proposed: contract for core features, legitimate interest for safety and fraud prevention, consent for marketing email and optional analytics cookies.
- Privacy notice, terms, community guidelines.
- Processor list with data processing agreements, EU region hosting where available, transfer mechanisms for non-EU processors.
- Records of processing.
- Confirm obligations under the EU Digital Services Act for a hosting service with user content (notice and action, statement of reasons for moderation decisions).
- Check local data protection law in each origin country before opening it (for example India's Digital Personal Data Protection Act, Sri Lanka's Personal Data Protection Act).
- Minimum age confirmed at 18.

### 11.2 Data minimization (Decided)

Only fields in 9.2 plus DOB, email, and flight data. No special category fields collected. Travel data is treated as sensitive in practice: never public, never in logs.

### 11.3 Retention (Proposed defaults)

| Data | Retention |
|---|---|
| Account and profile | Until deletion, then hard deleted within 30 days |
| Messages | Until either participant deletes their account; then removed for both after 30 days, except messages attached to an open moderation case |
| Flight participation | 12 months after the flight, then anonymized for analytics |
| Reports and moderation actions | 2 years after case closure |
| Admin audit log | 5 years |
| Analytics events | Pseudonymous, 25 months |
| Security logs | 90 days |
| Boarding pass scans | Not stored; only match result |

---

## 12. Flight data

### 12.1 Provider selection (Founder decision, run in Phase 0)

Evaluate 2 or 3 candidates (for example AeroDataBox, FlightAware AeroAPI, Aviationstack, or an enterprise source such as Cirium or OAG later) against:

- Schedule horizon: can it return a flight 3 to 6 months ahead? Students book early.
- Coverage of the market carriers and airports: Biman, US-Bangla, IndiGo, Air India, PIA, Nepal Airlines, SriLankan, Qatar Airways, Emirates, Etihad, flydubai, Air Arabia, Turkish Airlines, Gulf Air, Oman Air, Saudia, Kuwait Airways, and the main European carriers.
- Codeshare and operating carrier data.
- Status updates (delay, cancellation, diversion) for P1.
- Terms: are caching, storing, and showing the data to users allowed?
- Cost per lookup at 1,000, 10,000 and 100,000 monthly lookups.

Build one adapter. Keep the `FlightDataProvider` interface so a second adapter can be added later.

### 12.2 Lookup and caching

- A lookup by (flight number, date) hits the provider once; the normalized instance is stored and reused by all users.
- Re-sync schedule for instances with participants: daily until 72 hours before departure, then every 2 hours, then every 20 minutes from 6 hours before (P1).

### 12.3 Identity key (Decided)

A flight instance is unique on:

`(operating_carrier_iata, flight_number, origin_airport_iata, departure_local_date)`

- `departure_local_date` is the scheduled departure date in the origin airport's local time zone. This is how passengers and airlines refer to the date.
- Origin is part of the key because one flight number can cover several legs.
- Store `scheduled_departure_utc` and `scheduled_arrival_utc` as timestamps. Convert with the airport's IANA time zone for display.
- Never assume a flight number alone identifies a flight.
- Many market flights depart late at night (for example 01:25 from Doha). Test fixtures must include departures between 00:00 and 03:00 local time.

### 12.4 Codeshares

`flight_codeshares(marketing_carrier_iata, marketing_flight_number, departure_local_date, flight_instance_id)`. Lookups by a marketing number resolve here first.

### 12.5 Manual entries

Stored as instances with `source = user_reported`. When a provider instance with the same key appears, participants are moved to it in one transaction and the manual record is marked merged.

### 12.6 Schedule changes and disruption (P1)

- Time change: update instance, notify participants if departure moves more than 60 minutes.
- Cancellation: status `cancelled`, notify participants, keep them visible to each other for 48 hours (disrupted passengers often want to coordinate), prompt to add a replacement flight.
- Diversion: status `diverted`, notify.
- Provider unavailable: show last known data with "last updated" time. Never block core features on provider downtime.

---

## 13. Matching and discovery

### 13.1 Eligibility filters (Decided, applied before ranking)

A candidate is shown only if all are true:

- Both users active, email verified, not restricted or suspended.
- No block in either direction.
- Candidate's journey is visible and the candidate's participation for the matched segment is `visible` and still discoverable (8.4).
- Viewer has a journey that creates the context: for section 1 the viewer is on that flight instance; for section 2 the viewer has a segment on that route; for section 3 the viewer's journey has that final destination city.
- Viewer passes the candidate's request policy for showing the request button (the card may still show).
- Viewer is not already connected with the candidate (connected users appear in a separate "Your connections on this trip" row).

### 13.2 Ranking v1 (Proposed default, versioned as `ranking_v1`)

Section order first (5.3). Within a section, score:

| Signal | Points |
|---|---|
| Shares another segment of the journey too | +30 |
| Same final destination city | +20 |
| Same home country | +10 |
| Each shared language (max 2) | +10 |
| Each shared interest (max 3) | +5 |
| Same travel purpose | +5 |
| Verified badge (any, P1) | +5 |
| Profile complete (photo, bio, 3+ interests) | +5 |

Reason labels come from the top 2 contributing signals ("Also going to Berlin", "Speaks Bengali"). The score itself is never shown.

Age-range preference and network overlap are not in v1.

Every discovery response records the ranking version in analytics so versions can be compared and rolled back.

---

## 14. Architecture

### 14.1 Proposed stack (ADRs, confirm in Phase 0)

| Concern | Proposed | Why |
|---|---|---|
| App | One Next.js (TypeScript) app: web UI, `/api/v1` route handlers, `/admin` routes | One deployable for a small team |
| Domain logic | `packages/domain`, framework-free TypeScript | Testable, reusable by a future mobile app or separate API |
| Database | Managed PostgreSQL, EU region (Supabase is the candidate) | Relational data, strong constraints |
| ORM and migrations | Drizzle with SQL migrations in repo | Typed schema, reviewable migrations |
| Auth | Managed auth provider behind `AuthProvider` interface (Supabase Auth is the candidate) | Avoid building password and session handling |
| Realtime | Managed realtime service used only as a "new event" signal on private per-user channels; the client then fetches from the API | API stays the source of truth and the authorization point |
| Jobs | Managed background job service, or a Postgres job table with a scheduled worker | Email, push, flight sync, notifications |
| Storage | S3-compatible object storage, EU region | Profile photos |
| Email | Transactional email provider behind `EmailProvider` | |
| Push | Web Push (VAPID) behind `PushProvider` | PWA first |
| Rate limiting | Serverless-friendly Redis or a Postgres-backed limiter | No self-managed Redis in MVP |
| Analytics | Product analytics tool with EU hosting, plus `analytics_events` table for core loop events | |
| Errors and logs | Error tracking service, structured JSON logs | |
| Hosting | Managed hosting in an EU region | |

Redis, a separate API service, and a separate admin app are deferred until real load or team size requires them.

### 14.2 Architecture rules (Decided)

- Frontend is never the source of truth for business rules.
- Route handlers are thin: validate input, call a domain service, map the result.
- All third-party services sit behind interfaces in `packages/domain/ports`.
- Validate all input server-side with shared schemas from `packages/contracts`.
- Authorize every protected resource server-side, including object ownership checks.
- API versioned from the start at `/api/v1`.
- No production DB edits outside migrations or audited admin tooling.

---

## 15. Data model (outline, full schema produced in Phase 0)

Primary keys are UUIDs. Timestamps are `timestamptz` in UTC. Every table has `created_at`; mutable tables have `updated_at`.

- `users` (id, auth_provider_id, email, email_verified_at, date_of_birth, status, role, deleted_at)
- `user_profiles` (user_id, display_name, photo_key, home_country, bio, languages[], interests[], show_age, show_university, request_policy)
- `verifications` (id, user_id, type, status, university_id, verified_at, metadata)
- `universities` (id, name, country, email_domains[]) (P1)
- `countries` (iso2, name, region)
- `launch_markets` (country_iso2, role, enabled) where role is `origin` or `destination`
- `airports` (iata, icao, name, city, country_iso2, tz)
- `airlines` (iata, icao, name)
- `flight_instances` (id, operating_carrier_iata, flight_number, origin_iata, destination_iata, departure_local_date, scheduled_departure_utc, scheduled_arrival_utc, status, source, provider, provider_ref, last_synced_at, merged_into_id) UNIQUE on the identity key
- `flight_codeshares` (marketing_carrier_iata, marketing_flight_number, departure_local_date, flight_instance_id)
- `journeys` (id, user_id, purpose, final_destination_city, visible)
- `journey_segments` (id, journey_id, position, flight_instance_id) UNIQUE (journey_id, position)
- `flight_participants` (id, user_id, flight_instance_id, journey_segment_id, visibility, discoverable_until) UNIQUE (user_id, flight_instance_id)
- `flight_invites` (token, flight_instance_id, created_by, revoked_at)
- `connection_requests` (id, from_user_id, to_user_id, context_flight_instance_id, note, status, expires_at, responded_at)
- `connections` (id, user_low_id, user_high_id, status, removed_by, removed_at) UNIQUE (user_low_id, user_high_id)
- `conversations` (id, connection_id), `conversation_members` (conversation_id, user_id, last_read_at)
- `messages` (id, conversation_id, sender_id, client_message_id, body, created_at, deleted_at) UNIQUE (sender_id, client_message_id)
- `blocks` (blocker_id, blocked_id) UNIQUE pair
- `reports` (id, reporter_id, subject_user_id, subject_type, subject_id, reason, details, case_id)
- `moderation_cases` (id, subject_user_id, status, priority, assigned_to)
- `moderation_actions` (id, case_id, admin_id, action, reason, created_at) append-only
- `admin_audit_log` append-only
- `notifications`, `push_subscriptions`, `notification_preferences`
- `analytics_events`

Indexes follow real query paths: participants by flight instance and visibility, instances by route and date, journeys by final destination city and date, requests by recipient and status, messages by conversation and created_at.

---

## 16. API outline (full OpenAPI in Phase 0)

All under `/api/v1`. Every endpoint defines auth, authorization, request schema, response schema, errors, and rate limit. Collections are cursor-paginated. Errors use one shape: `{ error: { code, message, details? } }`.

- `auth`: handled by the auth provider; `POST /me/session/revoke-others`
- `me`: `GET/PATCH /me`, `DELETE /me`, `POST /me/export`, `GET/PATCH /me/settings`
- `profiles`: `GET /profiles/{userId}` (context-checked)
- `verifications`: `POST /verifications/university`, `POST /verifications/university/confirm` (P1), `POST /verifications/boarding-pass` (P1)
- `flights`: `GET /flights/lookup?number&date`, `GET /flights/search?origin&destination&date`, `POST /flights/manual`
- `journeys`: CRUD, `PUT /journeys/{id}/segments`, `PATCH /journeys/{id}/visibility`, `PATCH /journeys/{id}/segments/{segmentId}/visibility`
- `discovery`: `GET /discovery?journeyId&section` where section is `same_flight`, `same_route` or `same_destination`
- `connection-requests`: create, list incoming and outgoing, `POST /{id}/accept|decline|withdraw`
- `connections`: list, `DELETE /{id}`
- `conversations`: list, `GET /{id}/messages`, `POST /{id}/messages`, `POST /{id}/read`
- `notifications`: list, mark read, push subscription register
- `blocks`: create, list, delete
- `reports`: create
- `invites`: `POST /invites`, `GET /invites/{token}` (public, flight data only), `DELETE /invites/{token}`
- `admin`: users, cases, actions, audit log (role-checked, every write audited)

Idempotency: message send (client_message_id), request create (unique pending pair), invite create.

---

## 17. Rate limits (Decided, values configurable)

| Action | Limit |
|---|---|
| Login attempts | 10 per 15 min per IP and per account |
| Verification codes | 5 per hour |
| Flight lookups | 30 per hour per user |
| Flights added | See 10.3 |
| Requests | See 10.3 |
| Messages | See 10.3 |
| Reports | 20 per day |
| Invite page views | 60 per minute per IP |

---

## 18. Analytics and KPIs

### 18.1 Funnel

Signup → email verified → minimal profile → trip added → FlightMates viewed → request sent → request accepted → first message → reply received → second trip added.

### 18.2 Metrics

All metrics are broken down by origin country.

- **North Star:** connected journeys per week.
- **Activation:** % of new users who add a trip within 7 days.
- **Match coverage:** % of added trips with 1+ visible traveller, per section.
- **Density:** median visible travellers per active flight instance in the market, with hub legs (e.g. DOH → European airports) reported separately.
- **Request acceptance rate** and **reply rate** within 48 hours of connection.
- **Pre-flight engagement:** % of users active at least twice in the 14 days before a flight.
- **Journey retention:** % of users who add another trip within 180 days.
- **Invite loop:** signups per invite link shared.
- **Safety:** reports per 1,000 conversations, median time to first moderation action, % of cases actioned.

D1, D7, D30 are tracked but not used as success criteria, because most users fly a few times a year.

---

## 19. Testing requirements

- Unit tests for domain services, state machines, eligibility filters, ranking, flight identity key and time zone handling (including after-midnight departures).
- Integration tests for DB-backed services against a real Postgres.
- API contract tests against the OpenAPI spec.
- Authorization tests: every protected endpoint tested for another user's resource (IDOR).
- Block tests: after a block, discovery, requests, profile view and messaging all fail in both directions.
- End-to-end: signup → add trip → discover seeded traveller → request → accept → message → reconnect and see history.
- Migration test: build a clean DB from migrations in CI.
- Flight normalization regression fixtures from real provider responses.
- Load test discovery and messaging before public launch.
- CI gates: lint, typecheck, tests, build, migration check.

---

## 20. Roadmap

- **Phase 0, Definition (docs only):** founder decisions (Section 22), flight provider test, legal review kickoff, full schema and ERD, OpenAPI contracts, ADRs, UX (core flow done; remaining screens from 7.3).
- **Phase 1, Foundation:** repo, CI, environments, auth, DB, migrations, error tracking, logging.
- **Phase 2, Vertical slice:** signup, profile minimum, add one flight (provider or manual), see a seeded traveller, request, accept, message. Deployed to staging.
- **Phase 3, Core depth:** multi-segment trips, discovery sections and ranking, visibility, invites, notifications including web push.
- **Phase 4, Safety and admin:** block, report, moderation, auto-restriction, admin, audit log, limits.
- **Phase 5, Closed beta:** market seeding per origin country, instrumentation, QA, security review, density gate.
- **Phase 6, P1 features:** university verification, boarding pass verification, flight status sync, disruption flow.
- **Phase 7, Growth:** native apps, referrals, affiliate and premium experiments.

Detailed tickets: `docs/BUILD_PLAN.md`.

---

## 21. MVP acceptance criteria

- Registration, email code verification, login, reset, session revoke, deletion and data export work.
- Under-18 users cannot register.
- A user can add a flight by number and date, including via codeshare number and manual fallback.
- The same flight entered by two users resolves to one instance, including across time zones near midnight.
- A user can build a multi-segment trip.
- Discovery respects every filter in 13.1 and shows section and reason labels.
- Zero-match state and invite link work.
- Request, accept, decline, withdraw, expire and remove follow 8.2 and 8.3.
- Messages persist, deduplicate on retry, and remain available after reconnect.
- Push, email and in-app notifications deliver for requests and messages.
- Block immediately disables the relationship in both directions.
- Reports create cases; auto-restriction triggers at the threshold; admin actions are audited.
- No protected field from 9.2 is exposed by any endpoint (tested).
- Limits in 10.3 and 17 are enforced.
- Database builds from migrations; secrets are external; core analytics events are queryable.
- The flight provider can be swapped by adding an adapter without changing domain code.
- The 7 core screens match `docs/ux/design-system.md` and meet its accessibility rules.

---

## 22. Founder decisions

| # | Decision | Status | Answer or proposed default | Needed before |
|---|---|---|---|---|
| D1 | Launch market | **Decided (v0.3)** | South Asia (BD, IN, PK, NP, LK) ↔ Europe (EU/EEA, UK, CH), any hub | Phase 5 |
| D2 | Flight data provider | Open | Winner of the 12.1 evaluation | Phase 2 |
| D3 | Auth provider | Open | Managed provider with EU data option; Supabase Auth is the candidate | Phase 1 (F-05) |
| D4 | Hosting and database region | Open | Managed hosting and Postgres in EU region; Supabase EU is the candidate | Phase 1 (F-03) |
| D5 | Realtime service | Open | Managed realtime as signal only | Phase 3 |
| D6 | Age shown by default | Default | Off | Phase 2 |
| D7 | Wider matching default | **Decided (v0.3)** | Merged into the single trip visibility switch, default on | Phase 3 |
| D8 | Moderation rota and hours | Open | Founder plus one person, 24h target, coverage per 10.5 | Phase 5 |
| D9 | Legal reviewer | Open | Named before real user data | Phase 0 |
| D10 | Monetization timing | Default | None before the first origin country passes the density gate | Phase 7 |
| D11 | First origin countries to open | Open | The two that reach 200 beta users first | Phase 5 |

---

## 23. Monetization (unchanged in principle)

Free until network density is proven. Then travel affiliates (eSIM, insurance, transfers, lounges), then premium (advanced filters, extra verification, travel tools), then B2B (universities, corporate travel, airports). No aggressive advertising early. Monetization must never use travel data outside the product without explicit consent.

---

## 24. UI direction (Decided)

The reference design is the FlightMates Core Flow canvas (7 screens). Tokens, components and rules are in `docs/ux/design-system.md`. Summary:

- **Three moods, one system.** Navy header with dotted texture for trip and search screens; dusk-sky gradient with frosted glass for the traveller profile and the welcome screen; light lavender ground with white rounded cards for lists and chat.
- **Flights look like boarding passes.** Big IATA codes, dotted route line with a plane, notched ticket cards.
- **One primary color.** Indigo for primary actions, navy for secondary emphasis, one warm orange only for unread and notification dots.
- **Floating controls.** Bottom tab bar and message composer float as rounded pills.
- **Readable first.** Text meets WCAG AA contrast; touch targets are at least 44 px.
- **Photos later.** MVP uses gradients and initials; destination photography is P1.
