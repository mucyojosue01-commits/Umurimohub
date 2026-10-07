-- Phase C security and correctness hardening

alter function public.block_contract_event_change() set search_path = '';
alter function public.block_contract_delete() set search_path = '';
revoke execute on function public.is_contract_party(uuid) from anon;
revoke execute on function public.contract_counterparty_user(uuid) from anon;

create or replace function public.reject_completion(_contract_id uuid, _note text default null)
returns public.completion_status
language plpgsql security definer set search_path = ''
as $$
declare
  cc record;
  c record;
  requester_is_business boolean;
  requester_is_worker boolean;
  requester_is_team boolean;
  caller_is_business boolean;
  caller_is_worker boolean;
  caller_is_team boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into c from public.contracts where id = _contract_id for update;
  if not found then raise exception 'Contract not found' using errcode = 'P0002'; end if;
  if c.status <> 'active' then raise exception 'Only active contracts can be rejected'; end if;

  select * into cc from public.contract_completions where contract_id = _contract_id for update;
  if not found or cc.status <> 'requested' then
    raise exception 'No pending completion request found';
  end if;

  requester_is_business := public.is_business_member(c.business_id) and cc.requested_by = (select auth.uid());
  requester_is_worker := c.worker_id is not null
    and c.worker_id = public.my_worker_id()
    and cc.requested_by = (select auth.uid());
  requester_is_team := c.team_id is not null
    and public.is_team_lead(c.team_id)
    and cc.requested_by = (select auth.uid());

  if not (requester_is_business or requester_is_worker or requester_is_team) then
    raise exception 'Completion request is not owned by the authenticated contracting party' using errcode = '42501';
  end if;

  caller_is_business := public.is_business_member(c.business_id);
  caller_is_worker := c.worker_id is not null and c.worker_id = public.my_worker_id();
  caller_is_team := c.team_id is not null and public.is_team_lead(c.team_id);

  if requester_is_business then
    if not (caller_is_worker or caller_is_team) then
      raise exception 'Only the worker or team lead counterparty can reject completion' using errcode = '42501';
    end if;
  else
    if not caller_is_business then
      raise exception 'Only the business counterparty can reject completion' using errcode = '42501';
    end if;
  end if;

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

create or replace function public.request_completion(_contract_id uuid, _request_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  c record;
  cc public.contract_completions;
  existing public.contract_completions;
  requester_is_party boolean;
  counterparty_user uuid;
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

  if public.is_business_member(c.business_id) then
    if c.worker_id is not null then
      select wp.user_id into counterparty_user
      from public.worker_profiles wp where wp.id = c.worker_id;
    else
      select t.lead_user_id into counterparty_user
      from public.teams t where t.id = c.team_id;
    end if;
  else
    select bm.user_id into counterparty_user
    from public.business_members bm
    where bm.business_id = c.business_id
    order by bm.user_id
    limit 1;
  end if;

  if counterparty_user is not null and counterparty_user <> (select auth.uid()) then
    insert into public.notifications(user_id, kind, text, link)
    values (counterparty_user, 'completion_requested', 'Completion requested: ' || c.title, '/dashboard');
  end if;

  return cc.id;
end;
$$;

revoke execute on function public.request_completion(uuid,text) from public, anon;
revoke execute on function public.reject_completion(uuid,text) from public, anon;
grant execute on function public.request_completion(uuid,text) to authenticated;
grant execute on function public.reject_completion(uuid,text) to authenticated;
