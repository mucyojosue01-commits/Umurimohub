# UmurimoHub Contracts Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Phase A contract foundation so an authenticated business can accept an eligible application and propose a persisted contract that the addressed worker or authorized team lead can accept, activating the contract with an immutable audit trail and RLS protection.

**Architecture:** Keep the existing Supabase-backed application model and React/TanStack Router UI. Add contracts and contract_events as first-class database entities, enforce lifecycle transitions through database/RLS boundaries rather than client-only checks, and expose a small typed contract service/store surface to the dashboards. Keep milestone records reserved for Phase B and payment processing out of Phase A.

**Tech Stack:** Next.js/React/TypeScript, TanStack Router, TanStack Query, Supabase/Postgres/RLS, existing shadcn-style UI, Vitest/test tooling, ESLint, Prettier.

**Spec:** `docs/superpowers/specs/2026-10-07-contracts-workflow-design.md`

## Global Constraints

- Contract money is stored as integer `amount_rwf bigint`; no floating-point monetary storage or calculations.
- Currency defaults to `RWF`.
- Exactly one of `worker_id` or `team_id` is populated on every contract.
- One application can produce at most one contract via unique `application_id`.
- Contract lifecycle is `proposed → accepted → active → completed`, with `proposed → declined`, `proposed → cancelled`, `accepted → cancelled`, and `active → cancelled` as permitted alternatives.
- State transitions are enforced server-side/database-side, not only by UI.
- Contract events are append-only for normal users.
- Unrelated authenticated users cannot read contract details.
- Demo records remain separated from real user data.
- Phase A does not implement live payments, escrow, banking, dispute arbitration, advanced reputation scoring, AI contract generation, SMS/WhatsApp, or the full milestone workflow.
- CI must remain green: Prettier, ESLint, tests, production build.

## Review Focus

1. **Unaccepted application:** contract creation must fail even if a malicious client submits a direct insert; covered by the database contract-creation test.
2. **Duplicate contract:** a second contract for the same application must fail; covered by the unique application test.
3. **Cross-party access:** an unrelated authenticated worker/business must not read another party's contract or event; covered by RLS tests.
4. **Illegal transition / field tampering:** a party must not directly rewrite protected status, counterparty, amount, application, or audit history; covered by transition/RLS tests.
5. **Team authorization:** an ordinary team member must not accept/decline a team contract unless the team policy authorizes them; covered by team-contract authorization tests.

---

### Task 1: Map the existing data and application interfaces before implementation

**Files:**
- Read: `src/features/store/app-store.tsx`
- Read: `src/features/dashboard/panels.tsx`
- Read: `src/routes/opportunities.$id.tsx`
- Read: existing Supabase schema/migrations and generated types, if present
- Create: `docs/superpowers/plans/2026-10-07-contracts-workflow.md` (this plan)

**Interfaces:**
- Existing application status values: `submitted | viewed | shortlisted | rejected | accepted | withdrawn`.
- Existing authenticated user exposes `workerId`, `businessIds`, and `leadTeamIds`.
- Existing business application controls already update application status through Supabase.

- [ ] **Step 1: Confirm the current application/business/team table names and existing RLS policies** before writing SQL.
- [ ] **Step 2: Confirm whether repository migrations/generated Supabase types already exist and follow their established naming/layout.**
- [ ] **Step 3: Record any mismatch between the approved spec and the existing schema in the implementation PR notes; do not silently redesign the approved contract model.**
- [ ] **Step 4: Commit the plan separately before implementation begins.**

---

### Task 2: Add the contract domain schema and immutable event ledger

**Files:**
- Create: Supabase migration using the repository/Supabase CLI's generated migration filename for `contracts` and `contract_events`
- Modify: generated database types only if this repository maintains them manually
- Test: database/schema tests for constraints and lifecycle invariants

**Interfaces:**
- Produces `contracts` with:
  `id`, `opportunity_id`, `application_id`, `business_id`, `worker_id`, `team_id`, `title`, `scope`, `amount_rwf`, `currency`, `start_date`, `end_date`, `terms`, `status`, lifecycle timestamps, `created_at`, `updated_at`.
- Produces `contract_events` with:
  `id`, `contract_id`, `actor_user_id`, `event_type`, `from_status`, `to_status`, `metadata`, `created_at`.

- [ ] **Step 1: Write failing database tests for the positive contract shape, positive RWF amount, exactly-one-recipient constraint, and unique application constraint.**
- [ ] **Step 2: Run the focused database tests and confirm they fail before the schema exists.**
- [ ] **Step 3: Create the migration with the Supabase CLI's `migration new` flow, then define the tables, foreign keys, checks, indexes, timestamps, and status/event constraints from the approved spec.**
- [ ] **Step 4: Add the invariant that `application_id` is unique and exactly one of `worker_id`/`team_id` is non-null.**
- [ ] **Step 5: Add the immutable event ledger schema and prevent normal users from UPDATE/DELETE operations on event rows.**
- [ ] **Step 6: Run the focused database tests and confirm the schema constraints pass.**
- [ ] **Step 7: Run Supabase security advisors and resolve contract-related findings before proceeding.**
- [ ] **Step 8: Commit the schema as `feat: add contract domain schema`.**

---

### Task 3: Enforce contract creation and lifecycle transitions server-side

**Files:**
- Modify: contract migration/function/policy files established by Task 2
- Create: focused database tests for authorization and state transitions

**Interfaces:**
- Contract creation operation consumes an accepted `applications.id` and an authorized business membership.
- Transition operation accepts a contract id, requested target status, and authenticated actor; it validates the current state and actor before changing state and appending an event.

- [ ] **Step 1: Write failing tests proving an unaccepted application cannot create a contract, a non-business member cannot create one, and a duplicate contract cannot be created.**
- [ ] **Step 2: Write failing tests for `proposed → accepted → active`, `proposed → declined`, `proposed → cancelled`, and prohibited transitions.**
- [ ] **Step 3: Implement server-side/database authorization so only an authorized business member can create a contract from an accepted application.**
- [ ] **Step 4: Implement transition enforcement so worker/team acceptance and business cancellation cannot be achieved by arbitrary status updates.**
- [ ] **Step 5: Ensure every allowed lifecycle change appends exactly one event with actor, previous status, next status, and timestamp.**
- [ ] **Step 6: Ensure protected contract identity/counterparty/amount fields cannot be reassigned by normal users after proposal creation.**
- [ ] **Step 7: Run the focused authorization/state-machine tests and confirm all invalid operations fail.**
- [ ] **Step 8: Commit as `feat: enforce contract lifecycle authorization`.**

---

### Task 4: Add the typed contract data/service layer

**Files:**
- Create: `src/features/contracts/types.ts`
- Create: `src/features/contracts/service.ts`
- Create: `src/features/contracts/queries.ts` if the existing query conventions warrant a dedicated query module
- Modify: `src/features/store/app-store.tsx` only where a small shared contract surface is required
- Test: contract service tests

**Interfaces:**
- `ContractStatus = "proposed" | "accepted" | "active" | "completed" | "cancelled" | "declined"`.
- `Contract` exposes the persisted contract fields needed by dashboards.
- `createContractFromApplication(input)` returns the created contract or a typed error.
- `transitionContract(contractId, targetStatus)` returns the updated contract or a typed error.
- `getMyContracts()` returns only contracts permitted by the current Supabase session/RLS.

- [ ] **Step 1: Write failing service tests for create-from-accepted-application, duplicate rejection, accept, decline, and cancellation error mapping.**
- [ ] **Step 2: Implement the smallest typed service layer over Supabase; do not duplicate authorization rules that belong in the database.**
- [ ] **Step 3: Implement query invalidation/refetch behavior so contract lists update after mutations.**
- [ ] **Step 4: Run focused service tests and confirm they pass.**
- [ ] **Step 5: Commit as `feat: add contract service layer`.**

---

### Task 5: Upgrade business application management into contract proposal flow

**Files:**
- Modify: `src/features/dashboard/panels.tsx`
- Create: `src/features/contracts/ContractProposalDialog.tsx`
- Create: `src/features/contracts/ContractCard.tsx`
- Test: dashboard/component tests

**Interfaces:**
- Business action: accepted application → Create contract.
- Contract proposal form requires title, scope, positive RWF amount; dates and terms are optional.
- Proposal action creates exactly one proposed contract for that application.
- Existing application status controls remain intact.

- [ ] **Step 1: Write a failing UI test showing the Create contract action is unavailable for non-accepted applications and available for accepted ones.**
- [ ] **Step 2: Write a failing UI test that submits title, scope, amount, dates, and terms and invokes the contract service.**
- [ ] **Step 3: Implement the proposal dialog with validation and explicit RWF formatting.**
- [ ] **Step 4: Add proposed/active/completed contract summaries to the business dashboard without exposing private contract terms publicly.**
- [ ] **Step 5: Add loading, empty, unauthorized/not-found, failed-action, and success states.**
- [ ] **Step 6: Run focused dashboard tests and formatting/lint checks.**
- [ ] **Step 7: Commit as `feat: add business contract proposal flow`.**

---

### Task 6: Add worker and team contract response flow

**Files:**
- Modify: `src/features/dashboard/panels.tsx`
- Create: `src/features/contracts/ContractResponseCard.tsx`
- Test: worker/team dashboard tests

**Interfaces:**
- Worker recipient can accept or decline a proposed individual contract.
- Authorized team lead can accept or decline a proposed team contract.
- Successful acceptance results in `accepted` and then `active` according to the approved transition rules.
- Decline results in terminal `declined`.
- No ordinary unrelated user can act on the contract.

- [ ] **Step 1: Write failing tests for worker acceptance and decline, team-lead acceptance and decline, and unauthorized team-member rejection.**
- [ ] **Step 2: Implement contract response cards using the shared contract service.**
- [ ] **Step 3: Refresh the dashboard after every successful transition and show clear status/history.**
- [ ] **Step 4: Add the contract event history to the authorized contract view, read-only for normal users.**
- [ ] **Step 5: Run focused tests and verify the end-to-end response states.**
- [ ] **Step 6: Commit as `feat: add worker and team contract acceptance`.**

---

### Task 7: Add Phase A in-app notifications

**Files:**
- Modify: existing notification implementation only after confirming whether a persistent notifications table already exists
- Create/modify: contract notification adapter in `src/features/contracts/`
- Test: notification event tests

**Interfaces:**
- Events: application accepted, contract proposed, contract accepted, contract declined, contract cancelled.
- Phase A delivery is in-app only; SMS/email are not implemented.

- [ ] **Step 1: Write failing tests that each contract/application lifecycle event produces the correct recipient notification when the existing notification architecture supports persistence.**
- [ ] **Step 2: Implement notification creation through the existing notification mechanism rather than introducing a second notification store.**
- [ ] **Step 3: Ensure notification creation does not expose contract terms to unrelated users.**
- [ ] **Step 4: Run focused notification tests and commit as `feat: notify parties about contract lifecycle events`.**

---

### Task 8: Verify the complete Phase A flow and security boundary

**Files:**
- Modify: tests and small fixes only
- Test: end-to-end contract workflow/security tests

**Interfaces:**
- Full acceptance path:
  `Opportunity → Application → Accepted → Contract Proposed → Contract Accepted → Active`.

- [ ] **Step 1: Write an end-to-end test that creates/authenticates a business and worker/team, applies, accepts the application, proposes a contract, accepts it, and verifies the persisted active contract.**
- [ ] **Step 2: Assert the event ledger contains the expected lifecycle events in order with actor IDs and timestamps.**
- [ ] **Step 3: Assert an unrelated authenticated user cannot read the contract or mutate it.**
- [ ] **Step 4: Assert opportunity advertised-price changes do not mutate an existing contract amount.**
- [ ] **Step 5: Run the full test suite.**
- [ ] **Step 6: Run Prettier check, ESLint, and production build.**
- [ ] **Step 7: Run Supabase security advisors and verify no new contract/RLS security findings remain.**
- [ ] **Step 8: Commit any final fixes as focused commits; do not weaken tests to obtain green CI.**

---

### Task 9: Prepare the implementation branch for review

**Files:**
- All Phase A implementation files
- PR description

- [ ] **Step 1: Review the final diff against `docs/superpowers/specs/2026-10-07-contracts-workflow-design.md` requirement-by-requirement.**
- [ ] **Step 2: Run the same CI commands used by main before creating the PR: Prettier check, ESLint, tests, production build.**
- [ ] **Step 3: Verify no service-role secret or tracked environment file was introduced.**
- [ ] **Step 4: Create a PR from `feat/contracts-workflow-design` into `main` with the acceptance path, security model, tests, and explicit Phase A non-goals.**
- [ ] **Step 5: Do not recommend merge until CI is green and the end-to-end acceptance criterion is verified.**

## Execution Notes

- Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` when implementing this plan.
- Before any Supabase schema/auth/RLS implementation, re-check the current Supabase documentation/changelog and use the Supabase skill's migration/advisor workflow.
- Do not implement Phase B milestones beyond reserving the domain boundary; the existing demo/local milestone state must not be presented as persisted contract milestones.
- Prefer small commits after each independently testable task.
- Preserve the existing production CI workflow; do not modify it unless a genuine contract implementation requirement makes a change necessary.
