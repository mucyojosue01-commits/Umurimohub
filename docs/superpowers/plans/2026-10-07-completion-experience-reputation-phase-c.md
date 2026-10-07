# Phase C Completion, Verified Experience & Reputation Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Phase C workflow that turns an active UmurimoHub contract into an immutable completion record, verified professional experience, and evidence-based reputation signals.

**Architecture:** Additive PostgreSQL/Supabase workflow built on the existing Phase A contract and Phase B milestone models. Completion state changes are performed through narrowly scoped RPCs with row locking and append-only event records; finalized completion atomically creates a historical verified-experience snapshot and initial reputation evidence. React services/panels consume those server-authoritative transitions and expose the workflow in business and worker/team dashboards.

**Tech Stack:** Supabase PostgreSQL/RLS/RPCs, TypeScript, React, existing service/panel patterns, Vitest, SQL security tests, existing CI (Prettier, ESLint, Vitest, production build).

**Spec:** `docs/superpowers/specs/2026-10-07-completion-experience-reputation-phase-c-design.md`

## Global Constraints

- Preserve the Phase A contract status model: `proposed | active | declined | cancelled | completed`.
- Preserve Phase A and Phase B historical event records; do not rewrite history.
- Completion requires an active contract.
- Milestone-bearing contracts require every milestone to be `approved` before completion confirmation.
- Zero-milestone active contracts may proceed through two-party completion confirmation.
- A requester cannot confirm their own completion request.
- Completion state changes must be database-authoritative and atomic.
- Verified experience must originate only from a real completed UmurimoHub contract.
- Exactly one finalized completion and one verified-experience record may exist per contract.
- Reputation is evidence-first; do not introduce an opaque composite reputation score.
- Normal users cannot update/delete completion events, verified experience, or reputation evidence.
- No live payments, escrow, banking, settlement, payment-provider integration, or arbitration in Phase C.
- All schema changes must be source-controlled Supabase migrations and reflected in generated TypeScript database types.
- Runtime credentials must not be switched to the target Supabase project until schema/security verification is complete.

## Review Focus

1. **Completion race:** two parties attempt to finalize the same contract concurrently; only one confirmation may win and only one verified experience may be created. Test in Task 2.
2. **Milestone gate:** a contract with one non-approved milestone must not complete, even if all other milestones are approved. Test in Task 2.
3. **Self-confirmation:** the requester must never be able to confirm their own request. Test in Task 2.
4. **Historical integrity:** finalized completion, verified experience, and reputation evidence must not be user-editable/deletable. Test in Task 2.
5. **Team authorization:** ordinary team members must not gain completion authority merely from membership. Test in Task 2.

---

### Task 1: Phase C database foundation

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_phase_c_completion_experience_reputation.sql`
- Modify: generated Supabase TypeScript database types at the repository's existing generated-types path
- Test: `supabase/tests/completion_experience_reputation.sql`

**Interfaces:**
- Consumes: Phase A `contracts`/contract events and Phase B `milestones`/milestone events.
- Produces: `contract_completions`, `completion_events`, `verified_experiences`, `reputation_evidence`, completion enum(s), indexes, RLS policies, and supporting RPCs.

- [ ] **Step 1: Write failing SQL security/integrity tests** for completion eligibility, party authorization, milestone gating, self-confirmation prevention, finalization uniqueness, immutability, verified-experience provenance, and reputation-evidence provenance.
- [ ] **Step 2: Run the SQL test suite** and confirm failures are caused by missing Phase C schema/functions rather than test harness problems.
- [ ] **Step 3: Add completion schema** with `contract_completions`, `completion_events`, status enum, uniqueness constraints, timestamps, and append-only event structure.
- [ ] **Step 4: Add verified-experience schema** with the historical snapshot fields, worker/team XOR constraint, unique contract/completion references, and protected write paths.
- [ ] **Step 5: Add reputation-evidence schema** with subject typing, source references, evidence types, duplicate-source protection, and private metadata constraints.
- [ ] **Step 6: Add indexes and RLS** for contract/party lookups and ensure unrelated authenticated users cannot read or mutate protected records.
- [ ] **Step 7: Generate/update TypeScript database types** so all Phase C tables/enums/functions match the migration.
- [ ] **Step 8: Run formatting and SQL/type checks** and confirm the schema is internally consistent.
- [ ] **Step 9: Commit** the schema/types/test foundation with a focused migration commit.

---

### Task 2: Server-authoritative completion lifecycle

**Files:**
- Modify: `supabase/migrations/YYYYMMDDHHMMSS_phase_c_completion_experience_reputation.sql`
- Modify: `supabase/tests/completion_experience_reputation.sql`
- Create/Modify: `src/features/completion/service.ts`
- Test: `src/test/completion.test.ts`

**Interfaces:**
- Consumes: Phase A contract party relationships and Phase B milestone statuses.
- Produces:
  - `request_completion(contract_id, request_note)`
  - `withdraw_completion_request(contract_id, note)`
  - `reject_completion(contract_id, note)`
  - `confirm_completion(contract_id, note)`
  - completion query/read helpers used by dashboards.

- [ ] **Step 1: Add failing application/service tests** for request, withdrawal, rejection, confirmation, eligibility errors, authorization errors, and already-completed handling.
- [ ] **Step 2: Add failing database tests** for all four RPCs, including inactive contracts, unrelated users, self-confirmation, team-lead authorization, milestone gates, duplicate requests, and concurrent finalization.
- [ ] **Step 3: Implement `request_completion`** with authentication, active-contract validation, contracting-party authorization, one-pending-request enforcement, event insertion, and notification creation.
- [ ] **Step 4: Implement `withdraw_completion_request`** with requester-only authorization and atomic event/state handling.
- [ ] **Step 5: Implement `reject_completion`** with counterparty-only authorization and an active-contract result.
- [ ] **Step 6: Implement `confirm_completion`** with contract-row locking, milestone gate enforcement, counterparty validation, atomic contract completion, completion event insertion, and exactly-once finalization.
- [ ] **Step 7: Implement verified-experience creation inside the confirmation transaction** using historical snapshots from the authoritative contract/completion records.
- [ ] **Step 8: Implement initial reputation-evidence creation inside the same confirmation transaction**, including verified-project and applicable on-time/milestone evidence.
- [ ] **Step 9: Implement the TypeScript service wrappers** with typed arguments/results and consistent error handling.
- [ ] **Step 10: Run targeted SQL and Vitest tests**, then run the full existing test suite.
- [ ] **Step 11: Commit** the completion lifecycle implementation.

---

### Task 3: Reputation evidence derivation and history queries

**Files:**
- Modify: `supabase/migrations/YYYYMMDDHHMMSS_phase_c_completion_experience_reputation.sql`
- Modify: `src/features/completion/service.ts` or create `src/features/reputation/service.ts` following existing feature boundaries
- Test: `src/test/reputation.test.ts`
- Modify: `supabase/tests/completion_experience_reputation.sql`

**Interfaces:**
- Consumes: finalized completion and verified-experience records plus existing recommendations/connections and historical completed contracts.
- Produces typed queries for:
  - verified experience history;
  - worker/team evidence;
  - evidence counts;
  - repeat-employer signals;
  - on-time completion signals.

- [ ] **Step 1: Write failing tests** for verified-history retrieval, evidence aggregation, repeat-employer detection, on-time rules, and private-data exclusion.
- [ ] **Step 2: Implement deterministic evidence derivation** from existing platform records only; do not add AI scoring.
- [ ] **Step 3: Implement duplicate-safe evidence insertion/querying** so the same source event cannot create repeated evidence.
- [ ] **Step 4: Implement verified-history and evidence aggregation services** with worker/team authorization and public-safe projections where applicable.
- [ ] **Step 5: Run targeted tests and inspect representative results** for worker and team subjects.
- [ ] **Step 6: Commit** the reputation-evidence/query layer.

---

### Task 4: Persisted notifications for Phase C

**Files:**
- Modify: existing notifications migration/function area as appropriate
- Modify: `src/features/notifications` files following existing project structure
- Test: `src/test/completion-notifications.test.ts`

**Interfaces:**
- Consumes: completion lifecycle events.
- Produces notifications:
  - `completion_requested`
  - `completion_withdrawn`
  - `completion_rejected`
  - `completion_confirmed`
  - `verified_experience_created`

- [ ] **Step 1: Write failing notification tests** for recipient selection, event type, persistence, and duplicate prevention where required.
- [ ] **Step 2: Implement notification creation through the existing persisted-notification mechanism** without making notification delivery an authorization dependency.
- [ ] **Step 3: Verify notification behavior from request through finalization.**
- [ ] **Step 4: Run targeted and full tests.**
- [ ] **Step 5: Commit** notification integration.

---

### Task 5: Completion UI and dashboard integration

**Files:**
- Create/Modify: `src/features/completion/panels.tsx`
- Modify: existing business dashboard/contract panel files
- Modify: existing worker/team dashboard/contract panel files
- Modify: verified-profile/history components
- Test: `src/test/completion-ui.test.ts`

**Interfaces:**
- Consumes: completion service, milestone service, verified-experience queries, notifications.
- Produces: authenticated business and worker/team UI for request/confirm/reject/withdraw, readiness, history, and verified experience.

- [ ] **Step 1: Write failing UI/service integration tests** for the happy path, milestone-blocked state, rejection path, unauthorized state, already-completed state, and failure state.
- [ ] **Step 2: Implement completion readiness display** including milestone progress and clear explanation when completion is blocked.
- [ ] **Step 3: Implement worker/team request and withdraw actions** with server-authoritative mutation handling.
- [ ] **Step 4: Implement business pending-request review with Confirm/Reject actions** and explicit counterparty context.
- [ ] **Step 5: Implement completion history and status presentation** including requested/rejected/confirmed states and event history.
- [ ] **Step 6: Implement verified work-history presentation** using safe projections and evidence counts.
- [ ] **Step 7: Add loading, empty, unauthorized, not-found, validation, failure, success, incomplete-milestone, and already-completed states.
- [ ] **Step 8: Ensure public opportunity pages do not expose private completion/contract details.**
- [ ] **Step 9: Run focused UI/service tests and production build.**
- [ ] **Step 10: Commit** the Phase C UI integration.

---

### Task 6: End-to-end security and regression verification

**Files:**
- Modify: `supabase/tests/completion_experience_reputation.sql` as needed
- Modify: existing Phase A/B tests only if a compatibility assertion is required
- Modify: `docs/superpowers/plans/2026-10-07-completion-experience-reputation-phase-c.md`

**Interfaces:**
- Consumes: all Phase C schema, RPC, service, notification, and UI work.
- Produces: verified Phase C acceptance evidence and a final implementation plan record.

- [ ] **Step 1: Run the full SQL/security test suite** against a controlled Supabase environment.
- [ ] **Step 2: Run all Vitest tests.**
- [ ] **Step 3: Run Prettier and ESLint.**
- [ ] **Step 4: Run the production build.**
- [ ] **Step 5: Exercise the complete authenticated acceptance path:** active contract → completion request → counterparty confirmation → completed → verified experience.
- [ ] **Step 6: Exercise the milestone-gated path:** active contract → incomplete milestone → completion blocked → approve final milestone → completion allowed.
- [ ] **Step 7: Exercise rejection/retry:** request → reject → contract remains active → request again.
- [ ] **Step 8: Verify no Phase A/B contract or milestone history was rewritten and no payment behavior was introduced.**
- [ ] **Step 9: Review the diff for accidental public/private data exposure and unauthorized mutation paths.**
- [ ] **Step 10: Commit final test/verification adjustments.**

---

### Task 7: Code review and integration gate

**Files:**
- Entire Phase C diff

**Interfaces:**
- Consumes: verified Phase C branch.
- Produces: review-ready PR with CI evidence and no unverified completion claims.

- [ ] **Step 1: Run the superpowers code-review workflow against the complete branch.**
- [ ] **Step 2: Resolve any correctness, security, migration, or UX findings.**
- [ ] **Step 3: Re-run the full verification suite after every substantive fix.**
- [ ] **Step 4: Create the Phase C pull request with the spec, plan, scope, tests, and explicit non-goals linked in the description.**
- [ ] **Step 5: Do not merge until CI is green and the authenticated acceptance paths have been verified.**

---

## Execution Notes

- Implementation should occur on a dedicated feature branch, not directly on `main`.
- Before implementation, use the Superpowers worktree/isolation workflow and the required TDD workflow.
- Before Supabase implementation, read the installed Supabase skill and follow its migration/security guidance.
- Before claiming any task or phase is complete, use verification-before-completion and report only evidence-backed results.
- The existing UmurimoHub Supabase project remains the intended target, but runtime configuration should stay unchanged until the migration and security verification gates pass.
