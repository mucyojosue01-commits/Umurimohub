-- UmurimoHub Milestones Phase B
-- Source of truth: docs/superpowers/specs/2026-10-07-milestones-phase-b-design.md
-- Depends on Contracts Phase A.

create type public.milestone_status as enum ('pending','submitted','disputed','approved');

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  title text not null check (char_length(btrim(title)) between 3 and 200),
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  amount_rwf bigint not null check (amount_rwf > 0 and amount_rwf <= 1000000000000),
  due_date date not null,
  status public.milestone_status not null default 'pending',
  submission_note text check (submission_note is null or char_length(submission_note) <= 5000),
  submitted_at timestamptz,
  approved_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestones_contract_sequence_unique unique (contract_id, sequence)
);

create index milestones_contract_idx on public.milestones(contract_id);
create index milestones_status_idx on public.milestones(contract_id, status);

create table public.milestone_events (
  id bigint generated always as identity primary key,
  milestone_id uuid not null references public.milestones(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  actor uuid,
  event_type text not null check (event_type in ('created','submitted','disputed','resubmitted','approved')),
  from_status public.milestone_status,
  to_status public.milestone_status not null,
  note text check (note is null or char_length(note) <= 5000),
  at timestamptz not null default now()
);

create index milestone_events_milestone_idx on public.milestone_events(milestone_id, at);
create index milestone_events_contract_idx on public.milestone_events(contract_id, at);

grant select on public.milestones to authenticated;
grant select on public.milestone_events to authenticated;

alter table public.milestones enable row level security;
alter table public.milestone_events enable row level security;

create policy "contract parties read milestones" on public.milestones
for select to authenticated
using (public.is_contract_party(contract_id));

create policy "contract parties read milestone events" on public.milestone_events
for select to authenticated
using (public.is_contract_party(contract_id));

create or replace function public.block_milestone_event_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Milestone events are immutable';
end;
$$;

create trigger milestone_events_immutable
before update or delete on public.milestone_events
for each row execute function public.block_milestone_event_change();

create or replace function public.guard_milestone_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id
    or new.contract_id <> old.contract_id
    or new.sequence <= 0
    or new.created_at <> old.created_at
  then
    raise exception 'Milestone identity is immutable';
  end if;

  if old.status = 'approved' then
    raise exception 'Approved milestones are immutable';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'pending' and new.status = 'submitted')
    or (old.status = 'submitted' and new.status in ('disputed','approved'))
    or (old.status = 'disputed' and new.status = 'submitted')
  ) then
    raise exception 'Invalid milestone transition % -> %', old.status, new.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_milestone
before update on public.milestones
for each row execute function public.guard_milestone_update();

create or replace function public.block_approved_milestone_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'approved' then
    raise exception 'Approved milestones cannot be deleted';
  end if;
  return old;
end;
$$;

create trigger milestones_no_approved_delete
before delete on public.milestones
for each row execute function public.block_approved_milestone_delete();

create or replace function public.create_milestone(
  _contract_id uuid,
  _sequence integer,
  _title text,
  _description text,
  _amount_rwf bigint,
  _due_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  mid uuid;
  cp uuid;
  current_total bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if _sequence <= 0 then
    raise exception 'Sequence must be a positive integer';
  end if;
  if _amount_rwf <= 0 then
    raise exception 'Amount must be a whole number of RWF above 0';
  end if;
  if char_length(btrim(_title)) not between 3 and 200 then
    raise exception 'Title must be 3–200 characters';
  end if;
  if char_length(btrim(_description)) not between 10 and 5000 then
    raise exception 'Description must be 10–5000 characters';
  end if;

  select *
    into c
    from public.contracts
   where id = _contract_id
   for update;

  if not found then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if not public.is_business_member(c.business_id) then
    raise exception 'Only the hiring business can create milestones' using errcode = '42501';
  end if;

  if c.status <> 'active' then
    raise exception 'Only active contracts can have milestones';
  end if;

  select coalesce(sum(amount_rwf), 0)
    into current_total
    from public.milestones
   where contract_id = _contract_id;

  if current_total + _amount_rwf > c.amount_rwf then
    raise exception 'Milestone total would exceed the contract amount';
  end if;

  insert into public.milestones(
    contract_id, sequence, title, description, amount_rwf, due_date
  )
  values (
    _contract_id, _sequence, btrim(_title), btrim(_description), _amount_rwf, _due_date
  )
  returning id into mid;

  insert into public.milestone_events(
    milestone_id, contract_id, actor, event_type, from_status, to_status
  )
  values (
    mid, _contract_id, auth.uid(), 'created', null, 'pending'
  );

  cp := public.contract_counterparty_user(_contract_id);
  if cp is not null then
    insert into public.notifications(user_id, kind, text, link)
    values (
      cp,
      'milestone_created',
      'New milestone: ' || btrim(_title),
      '/dashboard'
    );
  end if;

  return mid;
end;
$$;

create or replace function public.update_pending_milestone(
  _milestone_id uuid,
  _sequence integer,
  _title text,
  _description text,
  _amount_rwf bigint,
  _due_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  c record;
  current_total bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select *
    into m
    from public.milestones
   where id = _milestone_id
   for update;

  if not found then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;

  select *
    into c
    from public.contracts
   where id = m.contract_id
   for update;

  if not public.is_business_member(c.business_id) then
    raise exception 'Only the hiring business can update milestones' using errcode = '42501';
  end if;

  if c.status <> 'active' then
    raise exception 'Only active contracts can have milestones updated';
  end if;

  if m.status <> 'pending' then
    raise exception 'Only pending milestones can be edited';
  end if;

  if _sequence <= 0 then
    raise exception 'Sequence must be a positive integer';
  end if;
  if _amount_rwf <= 0 then
    raise exception 'Amount must be a whole number of RWF above 0';
  end if;
  if char_length(btrim(_title)) not between 3 and 200 then
    raise exception 'Title must be 3–200 characters';
  end if;
  if char_length(btrim(_description)) not between 10 and 5000 then
    raise exception 'Description must be 10–5000 characters';
  end if;

  select coalesce(sum(amount_rwf), 0)
    into current_total
    from public.milestones
   where contract_id = m.contract_id
     and id <> m.id;

  if current_total + _amount_rwf > c.amount_rwf then
    raise exception 'Milestone total would exceed the contract amount';
  end if;

  update public.milestones
     set sequence = _sequence,
         title = btrim(_title),
         description = btrim(_description),
         amount_rwf = _amount_rwf,
         due_date = _due_date
   where id = _milestone_id;
end;
$$;

create or replace function public.delete_pending_milestone(_milestone_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  c record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select *
    into m
    from public.milestones
   where id = _milestone_id
   for update;

  if not found then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;

  select *
    into c
    from public.contracts
   where id = m.contract_id
   for update;

  if not public.is_business_member(c.business_id) then
    raise exception 'Only the hiring business can delete milestones' using errcode = '42501';
  end if;

  if m.status <> 'pending' then
    raise exception 'Only pending milestones can be deleted';
  end if;

  delete from public.milestones where id = _milestone_id;
end;
$$;

create or replace function public.submit_milestone(
  _milestone_id uuid,
  _submission_note text default null
)
returns public.milestone_status
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  c record;
  cp uuid;
  next_event text;
  note text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select *
    into m
    from public.milestones
   where id = _milestone_id
   for update;

  if not found then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;

  select *
    into c
    from public.contracts
   where id = m.contract_id
   for update;

  if c.status <> 'active' then
    raise exception 'Only active contracts can receive milestone submissions';
  end if;

  cp := public.contract_counterparty_user(c.id);
  if cp is null or cp <> auth.uid() then
    raise exception 'Only the contracted worker or team lead can submit' using errcode = '42501';
  end if;

  if m.status not in ('pending','disputed') then
    raise exception 'Only pending or disputed milestones can be submitted';
  end if;

  note := nullif(btrim(coalesce(_submission_note, '')), '');
  if note is not null and char_length(note) > 5000 then
    raise exception 'Submission note must be 5000 characters or fewer';
  end if;

  next_event := case when m.status = 'disputed' then 'resubmitted' else 'submitted' end;

  update public.milestones
     set status = 'submitted',
         submission_note = note,
         submitted_at = now(),
         disputed_at = null
   where id = m.id;

  insert into public.milestone_events(
    milestone_id, contract_id, actor, event_type, from_status, to_status, note
  )
  values (
    m.id, m.contract_id, auth.uid(), next_event, m.status, 'submitted', note
  );

  insert into public.notifications(user_id, kind, text, link)
    select user_id,
           'milestone_submitted',
           'Milestone submitted: ' || m.title,
           '/dashboard'
      from public.business_members
     where business_id = c.business_id;

  return 'submitted';
end;
$$;

create or replace function public.dispute_milestone(
  _milestone_id uuid,
  _note text default null
)
returns public.milestone_status
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  c record;
  cp uuid;
  note text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select *
    into m
    from public.milestones
   where id = _milestone_id
   for update;

  if not found then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;

  select *
    into c
    from public.contracts
   where id = m.contract_id
   for update;

  if not public.is_business_member(c.business_id) then
    raise exception 'Only the hiring business can dispute milestone work' using errcode = '42501';
  end if;

  if c.status <> 'active' then
    raise exception 'Only active contracts can have milestone disputes';
  end if;

  if m.status <> 'submitted' then
    raise exception 'Only submitted milestones can be disputed';
  end if;

  note := nullif(btrim(coalesce(_note, '')), '');
  if note is not null and char_length(note) > 5000 then
    raise exception 'Dispute note must be 5000 characters or fewer';
  end if;

  update public.milestones
     set status = 'disputed',
         disputed_at = now()
   where id = m.id;

  insert into public.milestone_events(
    milestone_id, contract_id, actor, event_type, from_status, to_status, note
  )
  values (
    m.id, m.contract_id, auth.uid(), 'disputed', 'submitted', 'disputed', note
  );

  cp := public.contract_counterparty_user(c.id);
  if cp is not null then
    insert into public.notifications(user_id, kind, text, link)
    values (
      cp,
      'milestone_disputed',
      'Milestone needs revision: ' || m.title,
      '/dashboard'
    );
  end if;

  return 'disputed';
end;
$$;

create or replace function public.approve_milestone(_milestone_id uuid)
returns public.milestone_status
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  c record;
  cp uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select *
    into m
    from public.milestones
   where id = _milestone_id
   for update;

  if not found then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;

  select *
    into c
    from public.contracts
   where id = m.contract_id
   for update;

  if not public.is_business_member(c.business_id) then
    raise exception 'Only the hiring business can approve milestone work' using errcode = '42501';
  end if;

  if c.status <> 'active' then
    raise exception 'Only active contracts can approve milestones';
  end if;

  if m.status <> 'submitted' then
    raise exception 'Only submitted milestones can be approved';
  end if;

  update public.milestones
     set status = 'approved',
         approved_at = now()
   where id = m.id;

  insert into public.milestone_events(
    milestone_id, contract_id, actor, event_type, from_status, to_status
  )
  values (
    m.id, m.contract_id, auth.uid(), 'approved', 'submitted', 'approved'
  );

  cp := public.contract_counterparty_user(c.id);
  if cp is not null then
    insert into public.notifications(user_id, kind, text, link)
    values (
      cp,
      'milestone_approved',
      'Milestone approved: ' || m.title,
      '/dashboard'
    );
  end if;

  return 'approved';
end;
$$;

revoke all on function public.create_milestone(uuid,integer,text,text,bigint,date) from public, anon;
revoke all on function public.update_pending_milestone(uuid,integer,text,text,bigint,date) from public, anon;
revoke all on function public.delete_pending_milestone(uuid) from public, anon;
revoke all on function public.submit_milestone(uuid,text) from public, anon;
revoke all on function public.dispute_milestone(uuid,text) from public, anon;
revoke all on function public.approve_milestone(uuid) from public, anon;

grant execute on function public.create_milestone(uuid,integer,text,text,bigint,date) to authenticated;
grant execute on function public.update_pending_milestone(uuid,integer,text,text,bigint,date) to authenticated;
grant execute on function public.delete_pending_milestone(uuid) to authenticated;
grant execute on function public.submit_milestone(uuid,text) to authenticated;
grant execute on function public.dispute_milestone(uuid,text) to authenticated;
grant execute on function public.approve_milestone(uuid) to authenticated;
