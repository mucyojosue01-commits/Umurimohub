# UmurimoHub Phase C — Completion, Verified Experience & Reputation Evidence Specification

**Date:** 2026-10-07  
**Status:** Approved  
**Depends on:** Contracts Phase A, Milestones Phase B

## 1. Purpose

Extend the UmurimoHub production workflow from:

**Opportunity → Application → Contract → Milestones**

to:

**Opportunity → Application → Contract → Milestones → Completion → Verified Experience → Reputation Evidence**

Phase C establishes a trustworthy record that work was actually completed and turns that verified work into durable professional evidence.

Phase C is deliberately evidence-first. It does not invent an opaque reputation score, process live payments, or act as a bank.

## 2. Scope

### In scope

1. A contracted party can request contract completion.
2. Completion is gated by the contract's fulfillment state.
3. For milestone contracts, all milestones must be approved before final completion.
4. For contracts without milestones, completion can proceed after the contracting parties confirm fulfillment.
5. The counterparty confirms or rejects a completion request.
6. A confirmed completion changes the Phase A contract to `completed`.
7. Completion actions are recorded in an immutable append-only event ledger.
8. A finalized completion creates a durable verified-experience record.
9. Verified experience preserves the worker/team, business, contract, opportunity, scope, amount, dates, and completion evidence needed for professional history.
10. Reputation evidence is derived from verified platform events rather than self-asserted claims.
11. Evidence includes signals such as verified project completion, on-time completion, successful milestone completion, repeat employer relationships, and verified recommendations/collaboration where existing platform records support them.
12. Worker/team dashboards expose verified work history and evidence signals.
13. Businesses can view relevant verified experience when evaluating workers/teams.
14. RLS and server-side transition rules protect completion, experience, and reputation evidence.
15. Automated tests cover authorization, lifecycle transitions, completion gates, immutability, derived evidence, and critical UI/service behavior.

### Explicitly out of scope

- Live payments, escrow, banking, settlement, or payment-provider integrations.
- AI-generated or opaque reputation scoring.
- Government or institutional scoring.
- Automated employment/background checks.
- Complex arbitration or legal dispute resolution.
- Public exposure of private contract terms or payment details.
- Rewriting historical contracts, milestones, or events.
- Self-created verified-completion claims.
- Evidence-file/document storage.
- SMS, WhatsApp, or email notification delivery.

## 3. Completion lifecycle

### Milestone contract

**Active Contract → Milestones → All Milestones Approved → Completion Request → Counterparty Confirmation → Completed**

### No-milestone contract

**Active Contract → Completion Request → Counterparty Confirmation → Completed**

### Completion request rules

- Only a party to the active contract may request completion.
- A worker/team may request completion when the work is ready for final confirmation.
- A business may request completion when the contracted work is fulfilled.
- For contracts with milestones, the database must reject a completion request until every milestone is `approved`.
- For contracts with zero milestones, there is no milestone gate.
- A completion request must not itself complete the contract.
- The counterparty must explicitly confirm completion.
- The requesting party may withdraw a pending completion request before confirmation.
- The counterparty may reject a completion request; rejection does not rewrite prior milestone history and leaves the contract active.
- A new completion request may be made after a rejection when the contract remains active.
- Once completion is confirmed, the contract becomes `completed` and completion is immutable.

## 4. Contract status compatibility

Phase C must preserve the Phase A status model:

`proposed | active | declined | cancelled | completed`

Phase C does not introduce a new contract status.

Completion confirmation is the authoritative transition from `active` to `completed`.

The existing Phase A contract event ledger remains authoritative for the historical contract transition. Phase C adds a dedicated completion ledger so the completion request/confirmation process is independently auditable.

## 5. Completion data model

### contract_completions

One finalized completion record per contract.

Fields:

- `id` UUID primary key
- `contract_id` UUID not null — references contracts(id), unique
- `requested_by` UUID not null — authenticated contracting party
- `request_note` text nullable
- `requested_at` timestamptz not null
- `confirmed_by` UUID nullable
- `confirmed_at` timestamptz nullable
- `rejection_note` text nullable
- `rejected_by` UUID nullable
- `rejected_at` timestamptz nullable
- `status` completion_status not null
- `completed_at` timestamptz nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

Completion statuses:

`requested | rejected | confirmed`

Rules:

- Only one active completion request may exist for a contract at a time.
- A confirmed completion is terminal.
- A contract can have at most one finalized completion.
- `completed_at` is set only when status becomes `confirmed`.
- Confirmed completion data cannot be edited or deleted by normal users.

### completion_events

Append-only completion audit ledger.

Fields:

- `id` bigint generated always as identity
- `completion_id` UUID not null
- `contract_id` UUID not null
- `actor` UUID nullable
- `event_type` text not null
- `from_status` completion_status nullable
- `to_status` completion_status not null
- `note` text nullable
- `at` timestamptz not null default now()

Supported event types:

- `requested`
- `withdrawn`
- `rejected`
- `confirmed`

Events are immutable. Normal users cannot update or delete them.

## 6. Completion integrity

Completion must be enforced server-side/database-side.

Before confirmation:

1. Lock the parent contract row.
2. Verify the contract is `active`.
3. Verify the completion request belongs to the contracting parties.
4. If milestones exist, verify every milestone is `approved`.
5. Verify no competing completion transition can occur.
6. Atomically confirm completion.
7. Record completion and contract events.
8. Create the verified-experience record in the same transaction.

The completion transaction must not partially succeed.

If any required condition fails, the contract remains active and no verified experience record is created.

## 7. Verified experience

A verified experience is durable professional history generated only from an actual UmurimoHub contract completion.

### verified_experiences

Fields:

- `id` UUID primary key
- `contract_id` UUID not null — unique reference to completed contract
- `completion_id` UUID not null — unique reference to finalized completion
- `opportunity_id` UUID not null
- `business_id` UUID not null
- `worker_id` UUID nullable
- `team_id` UUID nullable
- `title` text not null
- `scope` text not null
- `amount_rwf` bigint not null
- `currency` text not null default `RWF`
- `start_date` date nullable
- `end_date` date nullable
- `completed_at` timestamptz not null
- `milestone_count` integer not null default 0
- `approved_milestone_count` integer not null default 0
- `verified_at` timestamptz not null
- `created_at` timestamptz not null

Rules:

- Exactly one of `worker_id` or `team_id` must be populated.
- The worker/team and business must match the completed contract.
- The opportunity and contract references must match the historical contract relationship.
- The amount, title, scope, and dates are copied from the completed contract as historical snapshots.
- Verified experience is not editable by workers, teams, or businesses.
- A completed contract cannot create duplicate verified experience.
- Verified experience cannot be manually created through a public/client-side insert path.

The record is a historical snapshot, not a live view that changes when an opportunity or profile changes.

## 8. Verified experience visibility

### Worker

A worker may view their own verified experience records.

Relevant public/profile surfaces may show non-sensitive verified history, such as:

- verified project count;
- project titles;
- general scope;
- completion dates;
- relevant skills;
- verified/on-time signals.

Private contract terms and sensitive business information remain protected.

### Team

A team lead and authorized team members may view team verified experience.

The historical contracting party remains the team. Membership changes do not rewrite past experience.

### Business

A business may view verified experience for workers/teams when it is relevant to hiring/evaluation and allowed by profile visibility rules.

### Unrelated users

Unrelated users cannot access private verified-experience records.

Public exposure must use a deliberate projection that excludes private contract details.

### Admin

Admin may audit records for platform integrity.

Admin access does not permit silent rewriting of historical evidence.

## 9. Reputation evidence model

Phase C records evidence; it does not calculate an opaque universal score.

### Evidence principles

- Evidence must originate from verified UmurimoHub activity.
- Users cannot self-award verified evidence.
- Evidence should be attributable to a concrete event or durable relationship.
- Historical evidence is append-oriented.
- Removing or correcting evidence requires an auditable administrative mechanism in a later phase; Phase C does not silently delete history.

### Initial evidence types

Supported evidence may include:

- `verified_project_completed`
- `verified_on_time_completion`
- `verified_milestone_completion`
- `repeat_employer_relationship`
- `verified_collaboration`
- `verified_recommendation`

Only evidence that can be derived reliably from existing platform records should be emitted.

Examples:

- A completed contract creates `verified_project_completed`.
- A completed contract whose completion date is on or before the contractual end date may create `verified_on_time_completion`, subject to the exact date rule implemented in Phase C.
- Each approved milestone may contribute a `verified_milestone_completion` evidence event.
- A later completed contract with the same business and worker/team may establish `repeat_employer_relationship`.
- Existing platform connections/recommendations may support collaboration/recommendation evidence only when the relationship is sufficiently verified by existing records.

### reputation_evidence

Fields:

- `id` UUID primary key
- `subject_type` text not null — `worker` or `team`
- `subject_id` UUID not null
- `evidence_type` text not null
- `source_contract_id` UUID nullable
- `source_experience_id` UUID nullable
- `source_event_id` UUID nullable
- `occurred_at` timestamptz not null
- `metadata` JSONB not null default `{}`
- `created_at` timestamptz not null

Rules:

- Evidence rows are append-oriented and protected from normal user updates/deletes.
- Source references must point to real UmurimoHub records.
- Evidence cannot be generated from self-reported claims alone.
- Duplicate evidence for the same source event must be prevented.
- Evidence must not expose private contract terms through metadata.

## 10. On-time completion definition

Phase C uses a deterministic date rule rather than an AI judgment.

For a contract with a defined `end_date`:

- completion is on time when `completed_at` falls on or before the contractual `end_date`.
- if the contract has no `end_date`, no on-time evidence is generated.

For milestone-level evidence, the milestone's `due_date` is compared with its approval timestamp.

The UI must label these as evidence signals, not guarantees about work quality.

## 11. Reputation presentation

The product should prefer evidence statements over a single star-only reputation number.

Examples:

- **12 verified projects**
- **9 on-time completions**
- **18 verified milestones**
- **4 repeat clients**
- **7 verified recommendations**

Counts must come from durable evidence records and should not be fabricated.

Any future composite score must be a separate approved phase with explicit methodology, explainability, and anti-gaming controls.

## 12. Permissions and RLS

### Contracting worker

May:

- request completion for their contract;
- withdraw their own pending request;
- read their completion history;
- read their verified experience;
- read their reputation evidence.

May not:

- confirm their own completion request;
- edit finalized completion;
- create verified experience manually;
- create reputation evidence manually.

### Team contract

The authorized team lead acts for the contracting team.

Ordinary team membership does not independently authorize completion actions.

### Business

A business member with access to the contract may:

- request completion;
- confirm a worker/team completion request;
- reject a completion request;
- read completion history;
- read the resulting verified experience where permitted.

A business must not confirm its own completion request without an opposing contracting party.

### Unrelated users

Must not:

- read private completion records;
- mutate completion state;
- create verified experience;
- create or mutate reputation evidence.

### Admin

Admin may audit records and use explicit future resolution tooling.

Client-side role checks are not security boundaries. Database authorization is authoritative.

## 13. Server-side operation boundary

State-changing completion operations should use narrowly scoped database functions/RPCs.

Required operations:

- `request_completion`
- `withdraw_completion_request`
- `reject_completion`
- `confirm_completion`

The confirmation operation is responsible for the atomic completion transaction, including:

- contract state transition;
- completion state transition;
- completion event insertion;
- contract event insertion;
- verified-experience creation;
- initial reputation-evidence creation;
- relevant notifications.

Operations must:

- require authentication;
- verify contracting-party authorization;
- validate the current state;
- lock the relevant contract/completion rows;
- enforce milestone completion gates;
- prevent duplicate finalization;
- execute related writes atomically.

## 14. Notifications

Persisted in-app notifications:

- `completion_requested` — counterparty is informed.
- `completion_withdrawn` — counterparty is informed when applicable.
- `completion_rejected` — requester is informed.
- `completion_confirmed` — both parties are informed.
- `verified_experience_created` — worker/team receives confirmation that verified history was created.

Notifications are informational. Authorization and state are never based on notification delivery.

## 15. UI

### Business dashboard

For active contracts:

- completion readiness;
- milestone completion status;
- pending completion requests;
- Confirm / Reject actions;
- completion history;
- verified experience outcome.

### Worker/team dashboard

For active contracts:

- completion readiness;
- milestone status;
- Request completion action;
- pending request status;
- Withdraw action when allowed;
- rejection feedback;
- verified experience after confirmation.

### Verified work history

Worker/team profiles and dashboards should provide:

- verified project count;
- project history;
- completion dates;
- relevant scope/skills;
- milestone evidence where appropriate;
- evidence-based reputation signals.

### UX states

Every completion/experience view must handle:

- loading;
- empty;
- unauthorized;
- contract not found;
- contract not eligible;
- milestones incomplete;
- pending confirmation;
- rejected request;
- failed action;
- successful action;
- already completed;
- verified experience creation failure.

No private completion or contract information is exposed on public opportunity pages.

## 16. Validation

Client-side validation provides fast feedback only.

Database validation is authoritative.

At minimum:

- completion requires an active contract;
- only contracting parties can request;
- requester cannot self-confirm;
- only the counterparty can confirm/reject;
- milestone contracts require all milestones approved;
- zero-milestone contracts remain eligible for direct completion confirmation;
- only pending completion requests can be withdrawn/rejected/confirmed;
- completed contracts cannot accept new completion requests;
- exactly one finalized completion exists per contract;
- exactly one verified experience exists per completed contract;
- verified experience identity references match the source contract;
- reputation evidence source references are valid;
- duplicate source evidence is rejected.

## 17. Testing

### Database/security tests

Verify:

- inactive/proposed/declined/cancelled contracts cannot enter completion;
- unrelated users cannot read or mutate completion records;
- a worker cannot confirm their own completion request;
- a business cannot confirm its own completion request;
- team completion authority follows the authorized team lead;
- milestone contracts cannot complete while any milestone is not approved;
- zero-milestone active contracts can complete through two-party confirmation;
- rejected completion leaves the contract active;
- withdrawn requests cannot be confirmed;
- confirmed completion changes the contract to `completed`;
- completion events are immutable;
- duplicate finalization is impossible;
- exactly one verified experience is created;
- verified experience cannot be self-created;
- verified experience cannot be edited/deleted by normal users;
- reputation evidence is derived only from valid source records;
- duplicate evidence for the same source event is prevented.

### Application/service tests

Verify:

- completion readiness queries;
- milestone gate behavior;
- request/withdraw/reject/confirm mutation handling;
- cache invalidation;
- notifications;
- verified history queries;
- reputation evidence aggregation;
- correct handling of authorization and server errors.

### UI tests

Verify the critical path:

**Active Contract → Completion Request → Counterparty Confirmation → Completed → Verified Experience**

Verify the milestone-gated path:

**Active Contract → Incomplete Milestones → Completion Blocked**

Verify the rejection path:

**Request → Reject → Contract Remains Active → Request Again**

Verify:

- loading;
- empty;
- unauthorized;
- already completed;
- failure;
- success states.

## 18. Migration and compatibility

Phase C is additive to the merged Phase A and Phase B foundation.

Do not rewrite:

- Phase A contract status values;
- Phase A contract events;
- Phase B milestone statuses;
- Phase B milestone events.

All new schema changes must be source-controlled in Supabase migrations and reflected in generated TypeScript database types.

The target Supabase project for the UmurimoHub production architecture is the existing **Umurimohub** project. Migration work must preserve the existing application contract and must not switch runtime credentials until the target schema and security behavior are verified.

## 19. Acceptance criteria

Phase C is accepted when a real authenticated workflow can complete:

**Active Contract → Completion Request → Counterparty Confirmation → Completed → Verified Experience**

and, for milestone contracts:

**Active Contract → All Milestones Approved → Completion Request → Counterparty Confirmation → Completed**

with:

- persisted completion state;
- correct two-party authorization;
- milestone completion gate;
- immutable completion and contract event history;
- contract transitioned to `completed`;
- exactly one verified experience record;
- evidence-based reputation records;
- correct notifications;
- correct dashboard/profile state;
- RLS preventing unrelated access;
- invalid transitions rejected by the database;
- no self-created verified evidence;
- CI remaining green for formatting, linting, tests, and production build.

No live money movement is required or implied by Phase C.
