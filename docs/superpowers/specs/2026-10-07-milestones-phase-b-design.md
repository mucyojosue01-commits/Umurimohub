# UmurimoHub Milestones Phase B — Design Specification

**Date:** 2026-10-07  
**Status:** Draft for user review  
**Depends on:** Contracts Phase A

## 1. Purpose

Extend the production workflow from:

**Opportunity → Application → Contract**

to:

**Opportunity → Application → Contract → Milestones**

Phase B introduces a persisted, permissioned milestone workflow that records planned deliverables and their completion state without moving money.

The milestone layer becomes the foundation for the later:

**Completion → Verified Experience → Reputation → Payment Record**

phases.

## 2. Scope

### In scope

1. Businesses create ordered milestones for an active contract.
2. Each milestone has a deliverable, RWF amount, due date, and sequence.
3. Contracted workers or authorized team leads can submit a milestone.
4. Businesses can approve or dispute submitted work.
5. Disputed work can be resubmitted.
6. Approved milestones become immutable.
7. Milestone totals are checked against the immutable contract amount.
8. Milestone lifecycle events are recorded in an append-only audit ledger.
9. Parties receive persisted in-app notifications.
10. Dashboard UI exposes milestone creation, submission, approval, dispute, and current status.
11. RLS and server-side transition rules protect milestone data and actions.
12. Automated tests cover validation, authorization, transitions, totals, and core UI/service behavior.

### Explicitly out of scope

- Live payments, escrow, banking, or settlement.
- Payment-provider integrations.
- Arbitration or government dispute resolution.
- Advanced reputation scoring.
- File/document evidence storage.
- SMS, WhatsApp, or email notifications.
- Changing the Phase A contract status model.
- Rewriting historical contract or milestone events.

## 3. Milestone lifecycle

Primary state machine:

**pending → submitted → approved**

Dispute branch:

**submitted → disputed → submitted**

Rules:

- A newly created milestone is pending.
- Only a contracting worker or authorized team lead can submit pending work.
- Only the hiring business can approve or dispute submitted work.
- A disputed milestone returns to submitted only through a new worker/team submission.
- Approved is terminal for Phase B.
- There is no direct client-side status update.
- Invalid transitions must be rejected by the database.
- Historical lifecycle events remain readable and immutable.

## 4. Data model

### milestones

Fields:

- id UUID primary key
- contract_id UUID not null — references contracts(id)
- sequence integer not null — positive ordering value
- title text not null — concise milestone name
- description text not null — deliverable definition
- amount_rwf bigint not null — positive whole RWF amount
- due_date date not null
- status milestone_status not null default pending
- submission_note text nullable
- submitted_at timestamptz nullable
- approved_at timestamptz nullable
- disputed_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null

Constraints:

- amount_rwf > 0.
- sequence > 0.
- title and description have bounded lengths.
- A milestone belongs to exactly one contract.
- Contract deletion is already prohibited by Phase A.
- Approved milestone records cannot be deleted or materially edited.
- Milestone sequence is unique within a contract.
- A milestone can only belong to an active contract when created.

### milestone_events

Append-only event ledger:

- id bigint generated always as identity
- milestone_id UUID not null
- contract_id UUID not null
- actor UUID nullable
- event_type text
- from_status milestone_status nullable
- to_status milestone_status not null
- note text nullable
- at timestamptz not null default now()

Supported event types:

- created
- submitted
- disputed
- resubmitted
- approved

Events are immutable. Normal users cannot update or delete them.

## 5. Amount integrity

The contract amount is the financial ceiling for its milestones.

For every contract:

**sum(all milestone amounts) <= contract.amount_rwf**

This must be enforced server-side/database-side, not only in React.

When a milestone is created or its amount is changed while still pending:

1. Lock the relevant contract row.
2. Calculate the current milestone total.
3. Include the proposed new amount.
4. Reject the transaction if the resulting total exceeds the contract amount.

Approved milestone amounts cannot change.

Phase B does not mark any amount as paid.

Example:

- Contract: 1,500,000 RWF
- Milestone 1: 500,000
- Milestone 2: 400,000
- Milestone 3: 600,000
- Planned total: 1,500,000 RWF
- Approved total: 1,500,000 RWF
- Paid total: not represented in Phase B

The payment layer will later use approved milestones as input to payment records.

## 6. Contract relationship

Only active contracts can receive milestones.

A contract can have zero or more milestones.

The contract amount and contracting parties remain authoritative in the Phase A contracts table.

Changing or deleting an opportunity after contracting must not rewrite the milestone's contract relationship.

The milestone system must not duplicate worker, team, or business identity data unnecessarily; it derives party access from the parent contract.

## 7. Permissions and RLS

### Business

A business member with access to the contract may:

- create pending milestones;
- edit pending milestone content and amount;
- delete pending milestones;
- review submissions;
- approve submitted work;
- dispute submitted work;
- read milestone history.

### Individual worker

The worker contracted on the parent contract may:

- read their milestones;
- submit their milestones;
- resubmit disputed milestones;
- read milestone history.

### Team contract

The team lead authorized by the parent contract is the acting recipient for Phase B.

The team lead may:

- read team milestones;
- submit milestones;
- resubmit disputed milestones;
- read milestone history.

Ordinary team membership does not change the contracting party or grant new milestone authority in Phase B.

### Admin

Admin may audit the records and support exceptional resolution mechanisms later.

Phase B does not add silent admin rewriting of history.

### Unrelated users

Unrelated authenticated users must not be able to read, create, update, delete, submit, approve, or dispute milestones.

Client-side role checks are not security boundaries. Database functions and RLS are authoritative.

## 8. Server-side API/RPC boundary

Milestone state-changing operations should use narrowly scoped database functions rather than exposing unrestricted table updates.

Required operations:

- create_milestone
- update_pending_milestone
- delete_pending_milestone
- submit_milestone
- dispute_milestone
- approve_milestone

Each operation must:

- require authentication;
- verify the caller's relationship to the parent contract;
- lock the relevant row(s) where concurrent writes could violate invariants;
- validate the current status;
- make the state change and event insertion atomically;
- create the appropriate notification in the same transaction where practical.

## 9. Concurrency and integrity

The most important race condition is two milestone writes simultaneously exceeding the contract ceiling.

The implementation must lock the parent contract before validating the aggregate milestone total for create/update operations.

Other rules:

- Status transitions occur atomically.
- Duplicate sequence numbers are rejected.
- Duplicate submissions cannot create multiple simultaneous lifecycle transitions.
- Approval and dispute operations lock the milestone row.
- Event insertion happens in the same transaction as the status change.

## 10. Notifications

Persisted in-app notifications:

- milestone_created — contracting recipient is informed.
- milestone_submitted — business is informed.
- milestone_disputed — worker/team lead is informed.
- milestone_resubmitted — business is informed.
- milestone_approved — worker/team lead is informed.

Notifications are informational; authorization is never based on notification delivery.

## 11. UI

### Business dashboard

For an active contract:

- milestone list;
- total planned amount vs contract amount;
- create milestone form;
- edit/delete controls for pending milestones;
- submitted work review;
- Approve and Dispute actions;
- status and event/history presentation;
- clear remaining contract allocation.

### Worker/team dashboard

For an active contract:

- milestone list;
- amount and due date;
- deliverable description;
- Submit work action;
- submission note;
- resubmit after dispute;
- approved/disputed status;
- milestone history.

### UX states

Every milestone view must account for:

- loading;
- empty milestones;
- unauthorized;
- contract not found;
- failed action;
- validation error;
- successful action;
- no remaining contract allocation.

No private milestone information is exposed on public opportunity pages.

## 12. Validation

Client-side validation provides fast feedback only.

Database validation is authoritative.

At minimum:

- title length bounded;
- description length bounded;
- amount is an integer RWF value greater than zero;
- due date is valid;
- sequence is positive;
- sequence is unique per contract;
- contract must be active;
- aggregate milestone amount cannot exceed contract amount;
- only pending milestones can be edited/deleted;
- only pending/disputed milestones can be submitted;
- only submitted milestones can be approved/disputed.

## 13. Testing

### Database/security tests

Verify:

- milestone creation requires an active contract;
- inactive/proposed/declined/cancelled contracts reject milestone creation;
- unrelated users cannot read milestones;
- unrelated users cannot mutate milestones;
- worker can only act on their contracted milestone;
- team lead can only act on their contracted team's milestone;
- business can only act on milestones under its contracts;
- invalid status transitions are rejected;
- duplicate sequence values are rejected;
- contract amount ceiling is enforced under concurrent-safe operations;
- approved milestones cannot be edited or deleted;
- milestone events cannot be updated or deleted;
- event history records each transition.

### Application/service tests

Verify:

- validation messages;
- milestone query behavior;
- mutation success/error handling;
- cache invalidation;
- notifications are surfaced correctly.

### UI tests

Verify the critical authenticated path:

**Active Contract → Create Milestone → Submit → Approve**

and the dispute path:

**Submit → Dispute → Resubmit → Approve**

Also verify empty, loading, unauthorized, and failed-action states.

## 14. Migration and compatibility

Phase B must be additive to the merged Phase A foundation.

Do not rewrite the Phase A contract status enum.

The current production contract model uses:

proposed | active | declined | cancelled | completed

with acceptance and activation represented in the immutable contract event history.

Phase B treats active as the prerequisite state for milestones.

All new schema changes must be captured in a source-controlled Supabase migration and reflected in the generated TypeScript database types.

## 15. Acceptance criterion

A real authenticated business and contracted worker/team must be able to complete:

**Active Contract → Create Milestone → Submit → Approve**

with:

- persisted milestone data;
- correct RWF allocation;
- immutable milestone events;
- correct notifications;
- correct dashboard state;
- RLS preventing unrelated access;
- invalid transitions rejected by the database;
- CI remaining green for formatting, linting, tests, and production build.

The dispute path must also work:

**Submit → Dispute → Resubmit → Approve**

No live money movement is required or implied by Phase B.
