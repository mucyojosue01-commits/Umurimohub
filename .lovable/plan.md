# UmurimoHub — Next production slice: real data, accounts and trust network

## Where things stand today

- 24 pages exist: landing, opportunities (browse, detail, post), workers, teams, businesses, dashboard, messages, notifications, AI match, training, agriculture, insights, and info pages.
- All data is fictional and lives in one file (`src/features/data/demo.ts`): 8 workers, 4 teams, 4 businesses, 6 opportunities, courses, agriculture listings. It also holds the trust-score formula.
- Sign-in is fake. `/login` keeps a name, phone and role in browser storage. `/register` is a stub.
- Applications, saved items, messages, notifications, milestones and posted opportunities live in one in-browser store (`app-store.tsx`, used by 12 files). Nothing is shared between users.
- AI match works through a server function and the AI Gateway (`recommend.functions.ts` / `recommend.server.ts`). It reads the demo opportunities.
- Lovable Cloud is not on yet. There is no database and no auth middleware, and `src/start.ts` only has error and CSRF middleware.

**What we keep as-is:** the design system, the UI kit (`kit.tsx`, `site-chrome.tsx`), every page layout, the trust-score logic, the AI match prompt and its error handling, and the "demo" labels.

## Scope of this slice

1. Turn on Lovable Cloud and design the production data model.
2. Real accounts with roles: worker, business, team leader, learner, admin/institution.
3. Saved profiles, skills, businesses, teams and team members.
4. Opportunities and applications.
5. Trust network: connections, "worked with" links, referrals and recommendations.
6. Security rules for every table, plus input checks on every write.
7. Move from demo data to seeded development data without breaking any page.
8. Lay the groundwork and order for contracts, payments, reputation and messaging. These are designed now and built later.

## Phase 0 — Prepare (no visible change)

- Turn on Lovable Cloud.
- Add a data-access layer in `src/features/data/repo/`, with one module per area (workers, teams, businesses, opportunities, applications, network). At first each module just returns the demo data, using the same shapes as now. Every page moves over to this layer.
- Split `app-store.tsx` in two:
  - `session` (who is signed in, their roles)
  - `local-ui` (drafts, dismissed hints)
- Record the architecture rules in AGENTS.md.

**Done when:** every page reads data only through the repo layer, the app looks exactly the same, and tests pass.

## Phase 1 — Data model (one migration per area)

```text
auth.users ─┬─ profiles (1:1)
            ├─ user_roles (role enum, separate table)
            ├─ worker_profiles ── worker_skills ── skills (catalog) ── sectors
            ├─ learner_profiles
            ├─ business_members ── businesses
            ├─ team_members ── teams (lead_user_id)
            ├─ applications ── opportunities ── businesses
            └─ connections / referrals / recommendations
reference: provinces, districts, sectors, skills
```

**Main tables**

- **profiles:** id = user id, display_name, phone (E.164, unique), phone_verified, district_id, avatar_url, locale (rw/en/fr), created/updated timestamps.
- **user_roles:** user_id, role (`worker | team_lead | business | learner | admin | institution`), unique pair. Checked with a `has_role()` security-definer function.
- **worker_profiles:** user_id, title, bio, sector_id, rate_rwf, rate_unit, years_experience, available, availability_note, visibility (`public | network | private`).
- **worker_skills:** user_id, skill_id, level, verification (`self_declared | certificate | assessment | employer | platform`), verified_by, evidence_url.
  - Only an admin or institution can set any verification other than `self_declared`.
- **businesses:**
  - id, name, slug, sector_id, district_id, about, services[], verified, status
  - verification fields are admin-only
- **business_members:** business_id, user_id, role (`owner | manager | recruiter`).
- **teams:** id, name, slug, lead_user_id, sector_id, areas (district ids), summary, available.
- **team_members:** team_id, user_id, role, status (`invited | active | left`), joined_at.
- **opportunities:**
  - id, business_id, created_by, title, type, sector_id, district_id, pay_rwf, pay_unit, mode, duration, deadline, team_allowed, team_size
  - skills (join table `opportunity_skills`), summary, responsibilities[], requirements[]
  - status (`draft | open | closed | filled`), featured (admin-only), published_at
- **applications:**
  - id, opportunity_id, applicant_user_id or team_id (exactly one), kind (`individual | team | referral | invitation | rehire`), note
  - status (`submitted | viewed | shortlisted | rejected | accepted | withdrawn`), referred_by
  - unique per applicant and opportunity
- **connections:** requester, addressee, status (`pending | accepted | blocked`), relation (`worked_with | trained_with | employer | community`).
- **referrals:** referrer, referee, opportunity_id, note, status.
- **recommendations:** from_user, to_user, skill_id, text. Allowed only when the two users are connected or worked together.
- **saved_opportunities:** user_id, opportunity_id.
- **audit_log:** actor, action, entity, entity_id, at. Written by triggers on verification, role and featured changes.

**Every migration follows the same pattern:** create the table, add explicit permissions, turn on row security, add rules, add indexes on foreign keys and filter columns (district, sector, status, deadline).

## Phase 2 — Security rules

- **Profiles:**
  - Anyone can read the public columns through a `public_worker_cards` view: no phone, no email, filtered by visibility.
  - Owners can read and edit their own row.
- **Roles:** users can read their own roles. Only admins can add or remove roles, through a server function using the admin client after a `has_role` check.
  - At sign-up, the user can choose only from `worker | team_lead | business | learner`. A trigger refuses `admin` and `institution`.
- **Businesses:** anyone can read verified and active businesses. Members can read their own. Owners and managers can edit, except the `verified` field, which is admin-only (enforced by a column check in a trigger).
- **Teams:** anyone can read them. The lead can edit the team and invite members. Members can accept an invite or leave.
- **Opportunities:**
  - Anyone can read open ones.
  - Business members can read and edit their business's opportunities in any status (so drafts are still visible to their owners).
  - Admins can read everything and set `featured`.
- **Applications:**
  - The applicant (or the team lead/members) can read their own.
  - Members of the posting business can read applications to their opportunities.
  - Only the business side can change status. The applicant can only withdraw.
- **Connections, referrals, recommendations:** only the parties involved can read them. Accepted "worked with" counts are made public through an aggregate view only.
- **Input checks:**
  - Every write goes through a server function with a zod schema (lengths, RWF integers > 0, deadline in the future, phone `^\+2507\d{8}$`).
  - The same schema is shared with the forms on the page.

## Phase 3 — Auth and onboarding

- Sign-in with phone number and one-time code is the primary method (Rwanda context). Email/password is the fallback. Google is optional and needs your confirmation.
  - **Risk:** phone codes need an SMS provider set up. Until then we use email and mark phone as unverified.
- The `/register` stub becomes a step-by-step onboarding: role(s) → district → skills/business/team details. It writes `profiles` plus the role-specific profile.
- Protected pages move under `_authenticated/`: dashboard, messages, notifications, opportunities/new, plus new `/me/*` edit pages.
  - Public pages stay public and readable before sign-in, with "Sign in to apply" buttons instead of redirects.
- The header shows the signed-in state, a role switcher (for people with several roles), and sign-out with cache cleanup.

## Phase 4 — Switch the data layer

- Each repo module switches from demo data to the database, area by area, in this order:
  1. reference data
  2. workers
  3. businesses
  4. teams
  5. opportunities
  6. applications
  7. saved items
  8. network
- Public reads use public server functions with the publishable client. Personal reads and writes use `requireSupabaseAuth`.
- Pages use loaders with `ensureQueryData` and `useSuspenseQuery`. Every page with a loader gets an error view and a not-found view.
- Small adapters map database rows to the current `Worker` / `Team` / `Opportunity` shapes, so the page components barely change.
- `trustScore()` keeps working on a `Rep` object built from real counts. Reputation stays partial until contracts exist (Phase 6).
- AI match reads open opportunities from the database on the server. It can pre-fill from the signed-in worker's saved skills, district and availability.

## Phase 5 — Development seed data

- One seed migration with literal inserts (fixed IDs):
  - reference data (provinces, districts, sectors, skills) — real
  - the current demo businesses, teams, opportunities and courses, each marked `is_demo = true` and shown with the "Demo" badge
- Demo worker profiles are linked to seeded placeholder accounts that cannot sign in.
- A setting (`VITE_SHOW_DEMO`) controls whether demo rows show. In production it defaults to off, and the admin page can remove demo data.
- No national statistics are invented. Insights counts only real rows.

## Phase 6 — Later slices (designed now, built later)

1. **Contracts and milestones:** `contracts` (from an accepted application), `milestones`, `milestone_events`. Replaces the in-browser milestones.
2. **Messaging:** `threads`, `thread_participants`, `messages`, with live updates. Notifications table filled by triggers.
3. **Payments:** a mobile money provider (MTN MoMo / Airtel) behind a webhook route, plus a `payments` ledger. Funds are released only when a milestone is approved. Needs provider accounts.
4. **Reputation:** `reviews` tied to completed contracts. A scheduled job computes real trust scores; verified experience comes only from completed contracts.
5. **Training:** enrollments, assessments, and certificates that upgrade skill verification.
6. **Institutions and admin:** verification queues, reports, audit viewer.

## Dependencies and risks

- **Cloud first:** Cloud must be on before Phase 1. The auth middleware must be added to `src/start.ts` next to the existing CSRF middleware.
- **SMS provider:** phone codes depend on one being set up (see Phase 3).
- **Mixed demo and real data:** risk of confusing users. Mitigated by the `is_demo` flag and badge.
- **Shape changes:** changing data shapes could break the 12 pages that use the store. Mitigated by the repo layer and adapters, with one area switched at a time.
- **Self-assigned roles and verification:** could let people grant themselves power. Mitigated by the trigger and admin-only server functions.
- **Phone privacy:** never exposed in public views.
- **AI credits:** AI match keeps its graceful messages when the AI is busy or credits run out.

## Acceptance criteria

- **Accounts:** a new user can sign up, pick worker or business, finish onboarding, sign out and back in, and their data is still there on another device.
- **Opportunities:** a business user posts an opportunity. It shows publicly. A worker applies once (a duplicate application is refused). The business sees it and shortlists it. The worker sees the status change.
- **Teams:** a team lead creates a team, invites a member, the member accepts, and the team applies as a team.
- **Trust network:** two users connect. A recommendation is possible only after connecting. Referral applications record who referred them.
- **Security:** a user cannot read another user's applications or phone number, cannot set `verified` or `featured`, and cannot give themselves the admin role. Each case is checked with a test using two separate accounts.
- **No regressions:** every existing page still renders with seeded data, demo badges are visible, AI match works, and the build and tests pass.

## Technical notes

- Server functions live in `src/lib/*.functions.ts`, with server-only helpers in `*.server.ts`. The admin client is only loaded inside the function, after a role check.
- Lists use cursor pagination of 20 rows to keep data use low.
- Tests: Vitest for repo adapters and zod schemas. Security checks are SQL scripts run as two separate seeded users.
