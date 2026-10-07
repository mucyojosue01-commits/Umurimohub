-- UmurimoHub Phase C: Completion, Verified Experience & Reputation Evidence

create type public.completion_status as enum ('requested','rejected','confirmed');

create table public.contract_completions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null unique references public.contracts(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  request_note text check (request_note is null or char_length(request_note) <= 5000),
  requested_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id) on delete restrict,
  confirmed_at timestamptz,
  rejection_note text check (rejection_note is null or char_length(rejection_note) <= 5000),
  rejected_by uuid references auth.users(id) on delete restrict,
  rejected_at timestamptz,
  status public.completion_status not null default 'requested',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completion_confirmed_fields check (
    (status = 'confirmed' and confirmed_by is not null and confirmed_at is not null and completed_at is not null)
    or status <> 'confirmed'
  )
);

create table public.completion_events (
  id bigint generated always as identity primary key,
  completion_id uuid not null references public.contract_completions(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  actor uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('requested','withdrawn','rejected','confirmed')),
  from_status public.completion_status,
  to_status public.completion_status not null,
  note text check (note is null or char_length(note) <= 5000),
  at timestamptz not null default now()
);

create table public.verified_experiences (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null unique references public.contracts(id) on delete restrict,
  completion_id uuid not null unique references public.contract_completions(id) on delete restrict,
  opportunity_id text not null references public.opportunities(id) on delete restrict,
  business_id text not null references public.businesses(id) on delete restrict,
  worker_id text references public.worker_profiles(id) on delete restrict,
  team_id text references public.teams(id) on delete restrict,
  title text not null,
  scope text not null,
  amount_rwf bigint not null check (amount_rwf > 0),
  currency text not null default 'RWF' check (currency = 'RWF'),
  start_date date,
  end_date date,
  completed_at timestamptz not null,
  milestone_count integer not null default 0 check (milestone_count >= 0),
  approved_milestone_count integer not null default 0 check (approved_milestone_count >= 0),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint verified_experience_subject_xor check ((worker_id is null) <> (team_id is null))
);

create table public.reputation_evidence (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('worker','team')),
  subject_id text not null,
  evidence_type text not null check (evidence_type in (
    'verified_project_completed',
    'verified_on_time_completion',
    'verified_milestone_completion',
    'repeat_employer_relationship',
    'verified_collaboration',
    'verified_recommendation'
  )),
  source_contract_id uuid references public.contracts(id) on delete restrict,
  source_experience_id uuid references public.verified_experiences(id) on delete restrict,
  source_event_id bigint,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index reputation_evidence_source_event_unique
on public.reputation_evidence(source_event_id)
where source_event_id is not null;

create unique index reputation_evidence_contract_type_unique
on public.reputation_evidence(subject_type, subject_id, source_contract_id, evidence_type)
where source_contract_id is not null;

create index contract_completions_contract_status_idx on public.contract_completions(contract_id, status);
create index completion_events_contract_idx on public.completion_events(contract_id, at);
create index verified_experiences_worker_idx on public.verified_experiences(worker_id, completed_at desc);
create index verified_experiences_team_idx on public.verified_experiences(team_id, completed_at desc);
create index verified_experiences_business_idx on public.verified_experiences(business_id, completed_at desc);
create index reputation_evidence_subject_idx on public.reputation_evidence(subject_type, subject_id, occurred_at desc);

alter table public.contract_completions enable row level security;
alter table public.completion_events enable row level security;
alter table public.verified_experiences enable row level security;
alter table public.reputation_evidence enable row level security;

grant select on public.contract_completions to authenticated;
grant select on public.completion_events to authenticated;
grant select on public.verified_experiences to authenticated;
grant select on public.reputation_evidence to authenticated;

create policy "parties read completions" on public.contract_completions
for select to authenticated using (public.is_contract_party(contract_id));

create policy "parties read completion events" on public.completion_events
for select to authenticated using (public.is_contract_party(contract_id));

create policy "owners read verified experience" on public.verified_experiences
for select to authenticated using (
  (worker_id is not null and worker_id = public.my_worker_id())
  or (team_id is not null and public.is_team_lead(team_id))
  or public.is_business_member(business_id)
  or public.has_role('admin', auth.uid())
);

create policy "owners read reputation evidence" on public.reputation_evidence
for select to authenticated using (
  (subject_type = 'worker' and subject_id = public.my_worker_id())
  or (subject_type = 'team' and public.is_team_lead(subject_id))
  or exists (
    select 1
    from public.verified_experiences ve
    where ve.id = source_experience_id
      and (
        public.is_business_member(ve.business_id)
        or (ve.worker_id is not null and ve.worker_id = public.my_worker_id())
        or (ve.team_id is not null and public.is_team_lead(ve.team_id))
      )
  )
  or public.has_role('admin', auth.uid())
);

create or replace function public.block_completion_event_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Completion events are immutable';
end;
$$;

create trigger completion_events_immutable
before update or delete on public.completion_events
for each row execute function public.block_completion_event_change();

create or replace function public.block_verified_experience_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Verified experience is immutable';
end;
$$;

create trigger verified_experiences_immutable
before update or delete on public.verified_experiences
for each row execute function public.block_verified_experience_change();

create or replace function public.block_reputation_evidence_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Reputation evidence is immutable';
end;
$$;

create trigger reputation_evidence_immutable
before update or delete on public.reputation_evidence
for each row execute function public.block_reputation_evidence_change();

create or replace function public.guard_completion_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'confirmed' then
    raise exception 'Confirmed completion is immutable';
  end if;
  if new.contract_id <> old.contract_id or new.requested_by <> old.requested_by then
    raise exception 'Completion identity is immutable';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'requested' and new.status = 'rejected')
    or (old.status = 'rejected' and new.status = 'requested')
  ) then
    raise exception 'Invalid completion transition % -> %', old.status, new.status;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_completion
before update on public.contract_completions
for each row execute function public.guard_completion_update();

create or replace function public.request_completion(_contract_id uuid, _request_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  c record;
  cc public.contract_completions;
  existing public.contract_completions;
  requester_is_party boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into c from public.contracts where id = _contract_id for update;
  if not found then raise exception 'Contract not found' using errcode = 'P0002'; end if;
  if c.status <> 'active' then raise exception 'Only active contracts can request completion'; end if;

  requester_is_party :=
    public.is_business_member(c.business_id)
    or (c.worker_id is not null and c.worker_id = public.my_worker_id())
    or (c.team_id is not null and public.is_team_lead(c.team_id));

  if not requester_is_party then
    raise exception 'Only contracting parties can request completion' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.milestones m
    where m.contract_id = c.id and m.status <> 'approved'
  ) then
    raise exception 'All milestones must be approved before completion can be requested';
  end if;

  select * into existing from public.contract_completions where contract_id = c.id for update;

  if found and existing.status = 'confirmed' then
    raise exception 'Contract is already completed';
  end if;

  if found and existing.status = 'requested' then
    raise exception 'A completion request is already pending';
  end if;

  if found then
    update public.contract_completions
       set status = 'requested',
           request_note = nullif(btrim(coalesce(_request_note,'')), ''),
           requested_by = (select auth.uid()),
           requested_at = now(),
           confirmed_by = null,
           confirmed_at = null,
           completed_at = null,
           rejection_note = null,
           rejected_by = null,
           rejected_at = null
     where id = existing.id
     returning * into cc;
  else
    insert into public.contract_completions(contract_id, requested_by, request_note)
    values (c.id, (select auth.uid()), nullif(btrim(coalesce(_request_note,'')), ''))
    returning * into cc;
  end if;

  insert into public.completion_events(completion_id, contract_id, actor, event_type, from_status, to_status, note)
  values (cc.id, c.id, (select auth.uid()), 'requested',
          case when existing.id is null then null else existing.status end,
          'requested', left(_request_note,5000));

  if c.worker_id is not null then
    insert into public.notifications(user_id, kind, text, link)
    select bm.user_id, 'completion_requested', 'Completion requested: ' || c.title, '/dashboard'
    from public.business_members bm where bm.business_id = c.business_id;
  else
    insert into public.notifications(user_id, kind, text, link)
    select bm.user_id, 'completion_requested', 'Completion requested: ' || c.title, '/dashboard'
    from public.business_members bm where bm.business_id = c.business_id;
  end if;

  return cc.id;
end;
$$;

create or replace function public.withdraw_completion_request(_contract_id uuid, _note text default null)
returns public.completion_status
language plpgsql security definer set search_path = ''
as $$
declare cc record;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into cc from public.contract_completions where contract_id = _contract_id for update;
  if not found then raise exception 'No completion request found' using errcode = 'P0002'; end if;
  if cc.status <> 'requested' then raise exception 'Only a pending request can be withdrawn'; end if;
  if cc.requested_by <> (select auth.uid()) then raise exception 'Only the requester can withdraw' using errcode = '42501'; end if;

  update public.contract_completions
     set status = 'rejected',
         rejection_note = nullif(btrim(coalesce(_note,'')), ''),
         rejected_by = (select auth.uid()),
         rejected_at = now()
   where id = cc.id;

  insert into public.completion_events(completion_id, contract_id, actor, event_type, from_status, to_status, note)
  values (cc.id, _contract_id, (select auth.uid()), 'withdrawn', 'requested', 'rejected', left(_note,5000));

  return 'rejected';
end;
$$;

create or replace function public.reject_completion(_contract_id uuid, _note text default null)
returns public.completion_status
language plpgsql security definer set search_path = ''
as $$
declare
  cc record;
  c record;
  counterparty_ok boolean;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into c from public.contracts where id = _contract_id for update;
  if not found then raise exception 'Contract not found' using errcode = 'P0002'; end if;
  select * into cc from public.contract_completions where contract_id = _contract_id for update;
  if not found or cc.status <> 'requested' then raise exception 'No pending completion request found'; end if;
  if cc.requested_by = (select auth.uid()) then raise exception 'The requester cannot reject their own request' using errcode = '42501'; end if;

  counterparty_ok :=
    (c.worker_id is not null and cc.requested_by = public.my_worker_id() and public.is_business_member(c.business_id))
    or (c.team_id is not null and cc.requested_by = c.team_id::text and public.is_business_member(c.business_id))
    or (public.is_business_member(c.business_id) and cc.requested_by <> (select auth.uid()))
    or (
      (c.worker_id is not null and c.worker_id = public.my_worker_id())
      or (c.team_id is not null and public.is_team_lead(c.team_id))
    ) and public.is_business_member(c.business_id) is false;

  if not (
    public.is_business_member(c.business_id)
    or (c.worker_id is not null and c.worker_id = public.my_worker_id())
    or (c.team_id is not null and public.is_team_lead(c.team_id))
  ) then
    raise exception 'Only contracting parties can reject completion' using errcode = '42501';
  end if;

  if public.is_business_member(c.business_id) and cc.requested_by <> (select auth.uid()) then
    counterparty_ok := true;
  elsif (c.worker_id is not null and c.worker_id = public.my_worker_id()) and cc.requested_by <> (select auth.uid()) then
    counterparty_ok := true;
  elsif (c.team_id is not null and public.is_team_lead(c.team_id)) and cc.requested_by <> (select auth.uid()) then
    counterparty_ok := true;
  else
    counterparty_ok := false;
  end if;

  if not counterparty_ok then raise exception 'Only the counterparty can reject completion' using errcode = '42501'; end if;

  update public.contract_completions
     set status = 'rejected',
         rejection_note = nullif(btrim(coalesce(_note,'')), ''),
         rejected_by = (select auth.uid()),
         rejected_at = now()
   where id = cc.id;

  insert into public.completion_events(completion_id, contract_id, actor, event_type, from_status, to_status, note)
  values (cc.id, _contract_id, (select auth.uid()), 'rejected', 'requested', 'rejected', left(_note,5000));

  insert into public.notifications(user_id, kind, text, link)
  values (cc.requested_by, 'completion_rejected', 'Completion request rejected: ' || c.title, '/dashboard');

  return 'rejected';
end;
$$;

create or replace function public.confirm_completion(_contract_id uuid, _note text default null)
returns public.completion_status
language plpgsql security definer set search_path = ''
as $$
declare
  c record;
  cc record;
  counterparty_ok boolean;
  milestone_count integer;
  approved_count integer;
  ve_id uuid;
  completion_event_id bigint;
  subject_type text;
  subject_id text;
  other_contracts integer;
  milestone record;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  select * into c from public.contracts where id = _contract_id for update;
  if not found then raise exception 'Contract not found' using errcode = 'P0002'; end if;
  if c.status <> 'active' then raise exception 'Only active contracts can be confirmed'; end if;

  select * into cc from public.contract_completions where contract_id = c.id for update;
  if not found or cc.status <> 'requested' then raise exception 'No pending completion request found'; end if;
  if cc.requested_by = (select auth.uid()) then raise exception 'Requester cannot confirm their own completion request' using errcode = '42501'; end if;

  counterparty_ok :=
    public.is_business_member(c.business_id)
    or (c.worker_id is not null and c.worker_id = public.my_worker_id())
    or (c.team_id is not null and public.is_team_lead(c.team_id));
  if not counterparty_ok then raise exception 'Only the contracting counterparty can confirm' using errcode = '42501'; end if;

  select count(*)::integer, count(*) filter (where status = 'approved')::integer
    into milestone_count, approved_count
    from public.milestones where contract_id = c.id;
  if milestone_count > 0 and approved_count <> milestone_count then
    raise exception 'All milestones must be approved before completion can be confirmed';
  end if;

  update public.contract_completions
     set status = 'confirmed',
         confirmed_by = (select auth.uid()),
         confirmed_at = now(),
         completed_at = now()
   where id = cc.id;

  update public.contracts set status = 'completed', completed_at = now() where id = c.id;

  insert into public.completion_events(completion_id, contract_id, actor, event_type, from_status, to_status, note)
  values (cc.id, c.id, (select auth.uid()), 'confirmed', 'requested', 'confirmed', left(_note,5000))
  returning id into completion_event_id;

  insert into public.contract_events(contract_id, actor, event_type, from_status, to_status, note)
  values (c.id, (select auth.uid()), 'completed', 'active', 'completed', left(_note,1000));

  if c.worker_id is not null then
    subject_type := 'worker'; subject_id := c.worker_id;
  else
    subject_type := 'team'; subject_id := c.team_id;
  end if;

  insert into public.verified_experiences(
    contract_id, completion_id, opportunity_id, business_id, worker_id, team_id,
    title, scope, amount_rwf, currency, start_date, end_date, completed_at,
    milestone_count, approved_milestone_count, verified_at
  ) values (
    c.id, cc.id, c.opportunity_id, c.business_id, c.worker_id, c.team_id,
    c.title, c.scope, c.amount_rwf, c.currency, c.start_date, c.end_date, now(),
    milestone_count, approved_count, now()
  ) returning id into ve_id;

  insert into public.reputation_evidence(
    subject_type, subject_id, evidence_type, source_contract_id, source_experience_id,
    source_event_id, occurred_at, metadata
  ) values (
    subject_type, subject_id, 'verified_project_completed', c.id, ve_id,
    completion_event_id, now(), jsonb_build_object('milestone_count', milestone_count)
  );

  if c.end_date is not null and now()::date <= c.end_date then
    insert into public.reputation_evidence(
      subject_type, subject_id, evidence_type, source_contract_id, source_experience_id,
      source_event_id, occurred_at, metadata
    ) values (
      subject_type, subject_id, 'verified_on_time_completion', c.id, ve_id,
      completion_event_id, now(), '{}'::jsonb
    );
  end if;

  for milestone in
    select m.id, m.approved_at
    from public.milestones m
    where m.contract_id = c.id and m.status = 'approved'
  loop
    insert into public.reputation_evidence(
      subject_type, subject_id, evidence_type, source_contract_id, source_experience_id,
      source_event_id, occurred_at, metadata
    )
    select subject_type, subject_id, 'verified_milestone_completion', c.id, ve_id,
           me.id, coalesce(milestone.approved_at, now()), jsonb_build_object('milestone_id', milestone.id)
    from public.milestone_events me
    where me.milestone_id = milestone.id and me.event_type = 'approved'
    order by me.at desc limit 1
    on conflict do nothing;
  end loop;

  select count(*)::integer into other_contracts
  from public.contracts prior
  where prior.business_id = c.business_id
    and prior.status = 'completed'
    and prior.id <> c.id
    and (
      (subject_type = 'worker' and prior.worker_id = subject_id)
      or (subject_type = 'team' and prior.team_id = subject_id)
    );

  if other_contracts > 0 then
    insert into public.reputation_evidence(
      subject_type, subject_id, evidence_type, source_contract_id, source_experience_id,
      occurred_at, metadata
    ) values (
      subject_type, subject_id, 'repeat_employer_relationship', c.id, ve_id,
      now(), jsonb_build_object('prior_completed_contracts', other_contracts)
    ) on conflict do nothing;
  end if;

  insert into public.notifications(user_id, kind, text, link)
  select bm.user_id, 'completion_confirmed', 'Contract completed: ' || c.title, '/dashboard'
  from public.business_members bm where bm.business_id = c.business_id;

  if c.worker_id is not null then
    insert into public.notifications(user_id, kind, text, link)
    select wp.user_id, 'completion_confirmed', 'Contract completed: ' || c.title, '/dashboard'
    from public.worker_profiles wp where wp.id = c.worker_id and wp.user_id is not null;
    insert into public.notifications(user_id, kind, text, link)
    select wp.user_id, 'verified_experience_created', 'Verified work history created: ' || c.title, '/dashboard'
    from public.worker_profiles wp where wp.id = c.worker_id and wp.user_id is not null;
  else
    insert into public.notifications(user_id, kind, text, link)
    select t.lead_user_id, 'completion_confirmed', 'Team contract completed: ' || c.title, '/dashboard'
    from public.teams t where t.id = c.team_id and t.lead_user_id is not null;
    insert into public.notifications(user_id, kind, text, link)
    select t.lead_user_id, 'verified_experience_created', 'Verified team experience created: ' || c.title, '/dashboard'
    from public.teams t where t.id = c.team_id and t.lead_user_id is not null;
  end if;

  return 'confirmed';
end;
$$;

revoke all on function public.request_completion(uuid,text) from public, anon;
revoke all on function public.withdraw_completion_request(uuid,text) from public, anon;
revoke all on function public.reject_completion(uuid,text) from public, anon;
revoke all on function public.confirm_completion(uuid,text) from public, anon;
grant execute on function public.request_completion(uuid,text) to authenticated;
grant execute on function public.withdraw_completion_request(uuid,text) to authenticated;
grant execute on function public.reject_completion(uuid,text) to authenticated;
grant execute on function public.confirm_completion(uuid,text) to authenticated;
