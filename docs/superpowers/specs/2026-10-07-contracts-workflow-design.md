# UmurimoHub Contracts Workflow — Design Specification

## 1. Purpose

Extend the existing opportunity/application foundation into a trustworthy work lifecycle:

Opportunity → Application → Acceptance → Contract → Milestones → Completion → Verified Experience → Reputation → Payment Record

The first implementation slice covers acceptance and contracting. It establishes the domain model and authorization boundaries needed for milestones, completion, reputation, and payment integrations later.

## 2. Product principles
- UmurimoHub is economic infrastructure, not a job-board CRUD app.
- A contract represents an actual agreement between an opportunity owner/business and an individual worker or team.
- The same contract model supports individual and team engagements.
- Money is stored as integer RWF amounts; no floating-point monetary calculations.
- UmurimoHub records payment workflow state but does not claim to be a bank or payment processor.
- State transitions are enforced server-side/database-side, not only by UI.
- Parties can see only contracts and milestones they are authorized to see.
- Demo records remain clearly separated from real user data.

## 3. Scope
### Phase A — Contract foundation
1. Business reviews submitted applications.
2. Business accepts an eligible application.
3. Accepted application can create one contract.
4. Contract captures opportunity, business/client, worker or team, title/scope, agreed amount, currency (RWF initially), dates, terms, status, and timestamps.
5. Worker/team receives the contract proposal.
6. Worker/team can accept or decline the proposal.
7. Business can cancel a proposed contract.
8. Accepted contract becomes active.
9. Parties can view contract details in their dashboards.

### Phase B — Milestones
Design now, implementation after Phase A verification: ordered milestones, amount, due date, submission, approval, dispute, completion totals.

### Phase C — Completion/reputation
Design now, implementation after milestone verification: completion confirmation, verified project history, on-time completion signal, repeat employer signal, reputation event ledger.

### Phase D — Payment integration
Design now, implementation after completion flow: payment requested, payment confirmed, settlement recorded, provider/reference metadata, reconciliation state. No live money movement is part of Phase A.

## 4. Domain model
### contracts
Suggested fields:
- id UUID primary key
- opportunity_id UUID not null
- application_id UUID not null unique
- business_id UUID not null
- worker_id UUID nullable
- team_id UUID nullable
- title text not null
- scope text not null
- amount_rwf bigint not null, greater than 0
- currency text not null default RWF
- start_date date nullable
- end_date date nullable
- terms text nullable
- status: proposed, accepted, active, completed, cancelled, declined
- proposed_at, responded_at, activated_at, completed_at, cancelled_at, created_at, updated_at
- Constraint: exactly one of worker_id or team_id must be populated.

### contract_events
Immutable audit/event ledger: id, contract_id, actor_user_id, event_type, from_status, to_status, metadata jsonb, created_at.

### contract_milestones
Reserved for Phase B: id, contract_id, sequence, title, description, amount_rwf, due_date, status, submitted_at, approved_at, disputed_at, created_at, updated_at.

## 5. Application relationship
- An accepted application becomes the basis for a contract.
- Only an application in an eligible state can produce a contract.
- A single application can produce at most one contract.
- The contract stores application_id as a unique foreign key.
- The contract preserves original opportunity and application references.
- Changing an opportunity's advertised amount does not silently change an existing contract.

## 6. State machine
Application: submitted → viewed → shortlisted → accepted.
Contract: proposed → accepted → active → completed.
Alternative terminal transitions: proposed → declined; proposed → cancelled; accepted → cancelled; active → cancelled.
Only authorized actors may cause each transition.

### Business permissions
- Accept application
- Create contract from accepted application
- Cancel proposed/active contract where policy allows
- View contract and milestone state
- Confirm milestone completion in later phase

### Worker/team permissions
- View contracts addressed to them
- Accept or decline proposed contract
- Confirm their own completion in later phase
- Submit milestone work in later phase

### Admin permissions
- Read/audit all records according to platform policy
- Resolve exceptional/disputed cases
- Never silently rewrite event history

## 7. Team contracts
- team_id is the contracting recipient.
- Only an authorized team lead can accept/decline.
- Membership changes do not automatically rewrite historical contracts.
- The contract records the team as the accountable party.
- Individual members can be associated later with work evidence without changing the contracting party.

## 8. Security / RLS
- Business members can access contracts for their business.
- Worker can access contracts where worker_id maps to their account.
- Team lead/authorized team members can access team contracts according to defined team policy.
- Unrelated authenticated users cannot read contract details.
- Only authorized parties can create or transition contracts.
- Contract events are append-only for normal users.
- No client-side role check is sufficient authorization.
- Sensitive contact/payment information must not become public through opportunity or profile queries.

## 9. UI
Business: application management with Accept application, Create contract, contract preview/review, proposed/active/completed contract views.
Worker/team: dashboard with contract proposal, view terms, accept/decline, active contract, contract history.
Opportunity: after application acceptance, show application status but not private contract terms publicly.
Every contract view needs loading, empty, unauthorized/not-found, failed-action, and success states.

## 10. Notifications
Phase A should create in-app notification events for application accepted, contract proposed, contract accepted, contract declined, and contract cancelled. SMS/email remain separate.

## 11. Auditability
Important actions produce contract events: contract_proposed, contract_accepted, contract_declined, contract_cancelled, contract_activated, contract_completed. Events contain actor and timestamp and are not editable by normal users.

## 12. Testing requirements
Database/security: reject contracts for unaccepted applications; reject duplicate contracts; isolate worker/business access; prevent unauthorized field changes and transitions; preserve event history.
UI: business can accept application and propose contract; worker/team can see and accept/decline; invalid transitions are rejected; dashboards reflect current state.
CI must remain green: Prettier, ESLint, tests, production build.

## 13. Non-goals for Phase A
Live payment processing, escrow, banking functionality, dispute arbitration, government/institutional contract access, advanced reputation scoring, AI contract generation, SMS/WhatsApp delivery, and full milestone workflow.

## 14. Acceptance criteria
Phase A is complete only when a real authenticated business and worker/team can complete: Opportunity → Application → Accepted → Contract Proposed → Contract Accepted → Active, and the platform can prove the lifecycle through persisted records and immutable contract events while RLS prevents unrelated users from accessing or changing the data.