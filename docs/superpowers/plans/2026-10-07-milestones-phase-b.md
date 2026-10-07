# UmurimoHub Milestones Phase B — Implementation Plan

**Date:** 2026-10-07  
**Status:** Approved plan  
**Depends on:** Contracts Phase A  
**Spec:** `docs/superpowers/specs/2026-10-07-milestones-phase-b-design.md`

## Goal

Implement the production milestone workflow:

**Active Contract → Create Milestone → Submit → Approve**

and the dispute loop:

**Submit → Dispute → Resubmit → Approve**

This phase is persisted, permissioned, transactionally safe, and contains no live payment movement.

## Guardrails

1. Preserve Phase A contract statuses exactly: `proposed | active | declined | cancelled | completed`.
2. Only `active` contracts may receive milestones.
3. Database/RPC authorization is authoritative; React checks are only early UX validation.
4. State-changing operations use narrow authenticated RPCs.
5. Milestone events are append-only and immutable.
6. Milestone access derives from the parent contract; do not duplicate party identity unnecessarily.
7. RWF allocation is enforced server-side with the parent contract locked before aggregate validation.
8. Approved milestones are immutable.
9. Notifications are informational, never an authorization mechanism.
10. No escrow, banking, settlement, payment-provider integration, arbitration, or reputation scoring.

## Task 1 — Database migration

Create a new source-controlled migration after the Phase A migration.

Create enum `public.milestone_status`:
- pending
- submitted
- disputed
- approved

Create `public.milestones`:
- id UUID primary key
- contract_id UUID → contracts(id), restrict delete
- sequence positive integer
- title bounded text
- description bounded text
- amount_rwf positive bigint
- due_date date
- status milestone_status default pending
- submission_note nullable bounded text
- submitted_at nullable
- approved_at nullable
- disputed_at nullable
- created_at
- updated_at

Constraints:
- unique `(contract_id, sequence)`
- positive amount and sequence
- bounded text lengths
- only active contracts may create milestones
- approved rows cannot be materially edited/deleted

Create `public.milestone_events`:
- identity id
- milestone_id
- contract_id
- actor
- event_type
- from_status
- to_status
- note
- at

Allowed event types:
`created, submitted, disputed, resubmitted, approved`.

Enable RLS on milestones/events. Events are immutable.

## Task 2 — Secure RPC boundary

Implement authenticated RPCs:

- `create_milestone`
- `update_pending_milestone`
- `delete_pending_milestone`
- `submit_milestone`
- `dispute_milestone`
- `approve_milestone`

Every RPC must:
- reject unauthenticated callers
- verify contract relationship
- validate current state
- lock affected rows
- change state + insert event atomically
- create appropriate notification transactionally where practical

### Allocation invariant

For create/update:
1. lock parent contract with `FOR UPDATE`
2. verify status = active
3. calculate current milestone total
4. apply proposed amount
5. reject if total > contract.amount_rwf

This protects against concurrent writes exceeding the contract ceiling.

## Task 3 — Notifications

Use existing persisted `notifications` table.

Kinds:
- milestone_created → worker/team lead
- milestone_submitted → business members
- milestone_disputed → worker/team lead
- milestone_resubmitted → business members
- milestone_approved → worker/team lead

No private milestone data is exposed to unrelated users.

## Task 4 — Database types

Update `src/integrations/supabase/types.ts` for:
- milestones table
- milestone_events table
- milestone_status enum
- all six RPCs

Keep generated types consistent with the migration; do not introduce `any` as a shortcut.

## Task 5 — Service layer

Create `src/features/milestones/service.ts`.

Provide typed models and functions for:
- listing milestones
- listing milestone events
- create
- update pending
- delete pending
- submit
- dispute
- approve

Add client-side validation mirroring database rules where useful.

Use stable React Query keys and invalidate them after mutations.

## Task 6 — UI

Create `src/features/milestones/panels.tsx`.

### Business
For active contracts:
- contract amount
- planned total
- approved total
- remaining allocation
- milestone list
- create form
- edit/delete pending
- review submitted work
- Approve/Dispute
- event history

### Worker/team
For active contracts:
- milestone list
- deliverable
- amount
- due date
- status
- submission note
- Submit
- Resubmit after dispute
- history

For team contracts, only the authorized team lead performs milestone actions in Phase B.

Approved milestones become read-only.

## Task 7 — Dashboard integration

Integrate production contract milestones into the existing dashboard.

Do not remove the legacy/demo milestone display until production milestone UI is verified; clearly separate demo data from persisted contract milestones.

Public opportunity pages must not expose private milestone information.

## Task 8 — UX states

Handle:
- loading
- empty
- unauthorized
- missing contract
- failed mutation
- validation error
- no remaining allocation
- success

Use existing UmurimoHub components and toast conventions.

## Task 9 — Database/security tests

Add `supabase/tests/milestones.sql`.

Cover:
- active contract succeeds
- proposed/declined/cancelled/completed contracts reject
- unrelated users cannot read/mutate milestones/events
- business only acts on its contracts
- worker only acts on their contract
- team lead only acts on their team's contract
- valid state transitions
- invalid transitions rejected
- duplicate sequence rejected
- amount ceiling enforced
- concurrency-safe allocation behavior where test environment permits
- approved milestones cannot edit/delete
- event rows cannot edit/delete
- every transition records the correct event

## Task 10 — Application/service tests

Add `src/test/milestones.test.ts` for:
- title/description validation
- amount/date/sequence validation
- RPC error propagation
- query-key behavior
- mutation/cache invalidation behavior where testable

## Task 11 — UI acceptance

Verify:
**Active Contract → Create Milestone → Submit → Approve**

and:
**Submit → Dispute → Resubmit → Approve**

Also verify:
- business cannot approve before submission
- worker/team cannot approve
- worker/team cannot act on another contract
- approved milestone is read-only
- totals update after mutations
- dashboard state refreshes correctly

## Task 12 — Verification

Run the existing production gates without weakening them:
1. Prettier check
2. ESLint
3. Vitest
4. production build

Also verify migration/types consistency, no secrets, no temporary workflows, no Phase A status rewrite, and no unrelated changes.

If a required check cannot run locally, use GitHub Actions rather than weakening CI.

## Task 13 — PR workflow

Branch: `feat/milestones-phase-b`  
Base: `main`

Keep implementation commits logically grouped:
1. migration + types
2. service
3. UI/dashboard
4. tests
5. final fixes

Before opening the PR:
- compare branch with main
- inspect changed files
- run CI
- verify scope

Proposed PR title:
`feat: implement Phase B milestone workflow`

## Definition of done

A real authenticated business and contracted worker/team can complete both:

**Active Contract → Create Milestone → Submit → Approve**

and:

**Submit → Dispute → Resubmit → Approve**

with durable records, correct RWF allocation, immutable event history, persisted notifications, correct dashboard state, RLS protection, database-rejected invalid transitions, and green production CI.

No money moves in Phase B.
