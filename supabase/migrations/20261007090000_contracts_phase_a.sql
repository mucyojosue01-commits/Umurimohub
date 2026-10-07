-- UmurimoHub Contracts Phase A
-- Source of truth: docs/superpowers/specs/2026-10-07-contracts-workflow-design.md
-- This migration mirrors the managed Lovable Cloud contract foundation.

create type public.contract_status as enum (
  'proposed',
  'active',
  'declined',
  'cancelled',
  'completed'
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete restrict,
  opportunity_id text not null references public.opportunities(id) on delete restrict,
  business_id text not null references public.businesses(id) on delete restrict,
  worker_id text references public.worker_profiles(id) on delete restrict,
  team_id text references public.teams(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  scope text not null check (char_length(btrim(scope)) between 10 and 5000),
  amount_rwf bigint not null check (amount_rwf > 0 and amount_rwf <= 1000000000000),
  currency text not null default 'RWF' check (currency = 'RWF'),
  start_date date,
  end_date date,
  terms text check (terms is null or char_length(terms) <= 5000),
  status public.contract_status not null default 'proposed',
  proposed_by uuid not null,
  proposed_at timestamptz not null default now(),
  accepted_at timestamptz,
  activated_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_one_counterparty check ((worker_id is null) <> (team_id is null)),
  constraint contracts_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create index contracts_business_idx on public.contracts(business_id);
create index contracts_worker_idx on public.contracts(worker_id);
create index contracts_team_idx on public.contracts(team_id);
create index contracts_application_idx on public.contracts(application_id);

create table public.contract_events (
  id bigint generated always as identity primary key,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  actor uuid,
  event_type text not null check (
    event_type in ('proposed','accepted','activated','declined','cancelled','completed')
  ),
  from_status public.contract_status,
  to_status public.contract_status not null,
  note text check (note is null or char_length(note) <= 1000),
  at timestamptz not null default now()
);

create index contract_events_contract_idx on public.contract_events(contract_id, at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  text text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, created_at desc);

grant select on public.contracts to authenticated;
grant select on public.contract_events to authenticated;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

create or replace function public.is_contract_party(_cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contracts c
    where c.id = _cid
      and (
        public.is_business_member(c.business_id)
        or (c.worker_id is not null and c.worker_id = public.my_worker_id())
        or (c.team_id is not null and public.is_team_lead(c.team_id))
      )
  );
$$;

create or replace function public.contract_counterparty_user(_cid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select w.user_id
      from public.contracts c
      join public.worker_profiles w on w.id = c.worker_id
      where c.id = _cid
    ),
    (
      select t.lead_user_id
      from public.contracts c
      join public.teams t on t.id = c.team_id
      where c.id = _cid
    )
  );
$$;

create or replace function public.block_contract_event_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Contract events are immutable';
end;
$$;

create trigger contract_events_immutable
before update or delete on public.contract_events
for each row execute function public.block_contract_event_change();

create or replace function public.guard_contract_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.application_id <> old.application_id
    or new.opportunity_id <> old.opportunity_id
    or new.business_id <> old.business_id
    or new.worker_id is distinct from old.worker_id
    or new.team_id is distinct from old.team_id
    or new.amount_rwf <> old.amount_rwf
    or new.currency <> old.currency
    or new.title <> old.title
    or new.scope <> old.scope
    or new.proposed_by <> old.proposed_by
    or new.is_demo <> old.is_demo
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
    or new.terms is distinct from old.terms then
    raise exception 'Contract terms and parties are immutable';
  end if;

  if new.status is distinct from old.status
    and not (
      (old.status = 'proposed' and new.status in ('active','declined','cancelled'))
      or (old.status = 'active' and new.status = 'cancelled')
    ) then
    raise exception 'Invalid contract transition % -> %', old.status, new.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_contract
before update on public.contracts
for each row execute function public.guard_contract_update();

create or replace function public.block_contract_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Contracts cannot be deleted';
end;
$$;

create trigger contracts_no_delete
before delete on public.contracts
for each row execute function public.block_contract_delete();

alter table public.contracts enable row level security;
alter table public.contract_events enable row level security;
alter table public.notifications enable row level security;

create policy "parties read contracts"
on public.contracts for select to authenticated
using (
  public.is_business_member(business_id)
  or (worker_id is not null and worker_id = public.my_worker_id())
  or (team_id is not null and public.is_team_lead(team_id))
);

create policy "parties read contract events"
on public.contract_events for select to authenticated
using (public.is_contract_party(contract_id));

create policy "own notifications read"
on public.notifications for select to authenticated
using (user_id = auth.uid());

create policy "own notifications mark read"
on public.notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.create_contract(
  _application_id uuid,
  _title text,
  _scope text,
  _amount_rwf bigint,
  _start_date date default null,
  _end_date date default null,
  _terms text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  o record;
  wid text;
  cid uuid;
  cp uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into a from public.applications where id = _application_id;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  select * into o from public.opportunities where id = a.opportunity_id;
  if not public.is_business_member(o.business_id) then
    raise exception 'Only members of the hiring business can create contracts' using errcode = '42501';
  end if;

  if o.is_demo then
    raise exception 'Demo opportunities cannot have contracts';
  end if;

  if a.status <> 'accepted' then
    raise exception 'Only accepted applications can get a contract';
  end if;

  if exists (select 1 from public.contracts where application_id = _application_id) then
    raise exception 'A contract already exists for this application' using errcode = '23505';
  end if;

  if a.team_id is null then
    select id into wid from public.worker_profiles where user_id = a.applicant_user_id limit 1;
    if wid is null then
      raise exception 'Applicant has no worker profile';
    end if;
  end if;

  if _amount_rwf <= 0 then
    raise exception 'Contract amount must be greater than zero';
  end if;

  if _end_date is not null and _start_date is not null and _end_date < _start_date then
    raise exception 'End date must be on or after start date';
  end if;

  insert into public.contracts(
    application_id, opportunity_id, business_id, worker_id, team_id,
    title, scope, amount_rwf, start_date, end_date, terms, proposed_by,
    is_demo
  )
  values (
    a.id, o.id, o.business_id, wid, a.team_id,
    btrim(_title), btrim(_scope), _amount_rwf, _start_date, _end_date,
    nullif(btrim(coalesce(_terms, '')), ''), auth.uid(), false
  )
  returning id into cid;

  insert into public.contract_events(contract_id, actor, event_type, from_status, to_status)
  values (cid, auth.uid(), 'proposed', null, 'proposed');

  cp := public.contract_counterparty_user(cid);
  if cp is not null then
    insert into public.notifications(user_id, kind, text, link)
    values (cp, 'contract_proposed', 'New contract proposal: ' || btrim(_title), '/dashboard');
  end if;

  return cid;
end;
$$;

create or replace function public.respond_contract(
  _contract_id uuid,
  _accept boolean,
  _note text default null
)
returns public.contract_status
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  cp uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into c from public.contracts where id = _contract_id for update;
  if not found then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  cp := public.contract_counterparty_user(c.id);
  if cp is null or cp <> auth.uid() then
    raise exception 'Only the worker or team lead on this contract can respond' using errcode = '42501';
  end if;

  if c.status <> 'proposed' then
    raise exception 'Contract is not awaiting a response';
  end if;

  if _accept then
    update public.contracts
    set status = 'active', accepted_at = now(), activated_at = now()
    where id = c.id;

    insert into public.contract_events(
      contract_id, actor, event_type, from_status, to_status, note
    )
    values
      (c.id, auth.uid(), 'accepted', 'proposed', 'active', left(_note, 1000)),
      (c.id, auth.uid(), 'activated', 'proposed', 'active', null);

    insert into public.notifications(user_id, kind, text, link)
    select user_id, 'contract_accepted', 'Contract accepted: ' || c.title, '/dashboard'
    from public.business_members
    where business_id = c.business_id;

    return 'active';
  end if;

  update public.contracts
  set status = 'declined', declined_at = now()
  where id = c.id;

  insert into public.contract_events(
    contract_id, actor, event_type, from_status, to_status, note
  )
  values (c.id, auth.uid(), 'declined', 'proposed', 'declined', left(_note, 1000));

  insert into public.notifications(user_id, kind, text, link)
  select user_id, 'contract_declined', 'Contract declined: ' || c.title, '/dashboard'
  from public.business_members
  where business_id = c.business_id;

  return 'declined';
end;
$$;

create or replace function public.cancel_contract(
  _contract_id uuid,
  _note text default null
)
returns public.contract_status
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  cp uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into c from public.contracts where id = _contract_id for update;
  if not found then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if not public.is_business_member(c.business_id) then
    raise exception 'Only the hiring business can cancel' using errcode = '42501';
  end if;

  if c.status not in ('proposed','active') then
    raise exception 'Contract can no longer be cancelled';
  end if;

  update public.contracts
  set status = 'cancelled', cancelled_at = now()
  where id = c.id;

  insert into public.contract_events(
    contract_id, actor, event_type, from_status, to_status, note
  )
  values (c.id, auth.uid(), 'cancelled', c.status, 'cancelled', left(_note, 1000));

  cp := public.contract_counterparty_user(c.id);
  if cp is not null then
    insert into public.notifications(user_id, kind, text, link)
    values (cp, 'contract_cancelled', 'Contract cancelled: ' || c.title, '/dashboard');
  end if;

  return 'cancelled';
end;
$$;

revoke all on function public.create_contract(uuid,text,text,bigint,date,date,text) from public, anon;
revoke all on function public.respond_contract(uuid,boolean,text) from public, anon;
revoke all on function public.cancel_contract(uuid,text) from public, anon;

grant execute on function public.create_contract(uuid,text,text,bigint,date,date,text) to authenticated;
grant execute on function public.respond_contract(uuid,boolean,text) to authenticated;
grant execute on function public.cancel_contract(uuid,text) to authenticated;

create or replace function public.notify_application_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    if new.team_id is not null then
      select t.lead_user_id into recipient
      from public.teams t
      where t.id = new.team_id;
    else
      recipient := new.applicant_user_id;
    end if;

    if recipient is not null then
      insert into public.notifications(user_id, kind, text, link)
      values (
        recipient,
        'application_accepted',
        'Your application was accepted.',
        '/dashboard'
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger application_accepted_notification
after update of status on public.applications
for each row execute function public.notify_application_accepted();
