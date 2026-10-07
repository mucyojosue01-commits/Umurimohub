create or replace function public.request_completion(_contract_id uuid, _request_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  c record;
  cc public.contract_completions;
  existing public.contract_completions;
  actor uuid := (select auth.uid());
  requester_is_business boolean;
  requester_is_worker boolean;
  requester_is_team boolean;
  counterparty_user uuid;
begin
  if actor is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into c from public.contracts where id = _contract_id for update;
  if not found then raise exception 'Contract not found' using errcode = 'P0002'; end if;
  if c.status <> 'active' then raise exception 'Only active contracts can request completion'; end if;

  requester_is_business := exists (
    select 1 from public.business_members bm where bm.business_id = c.business_id and bm.user_id = actor
  );
  requester_is_worker := c.worker_id is not null and exists (
    select 1 from public.worker_profiles wp where wp.id = c.worker_id and wp.user_id = actor
  );
  requester_is_team := c.team_id is not null and exists (
    select 1 from public.teams t where t.id = c.team_id and t.lead_user_id = actor
  );

  if not (requester_is_business or requester_is_worker or requester_is_team) then
    raise exception 'Only contracting parties can request completion' using errcode = '42501';
  end if;

  if exists (select 1 from public.milestones m where m.contract_id = c.id and m.status <> 'approved') then
    raise exception 'All milestones must be approved before completion can be requested';
  end if;

  select * into existing from public.contract_completions where contract_id = c.id for update;
  if found and existing.status = 'confirmed' then raise exception 'Contract is already completed'; end if;
  if found and existing.status = 'requested' then raise exception 'A completion request is already pending'; end if;

  if found then
    update public.contract_completions
       set status='requested', request_note=nullif(btrim(coalesce(_request_note,'')),''),
           requested_by=actor, requested_at=now(), confirmed_by=null, confirmed_at=null,
           completed_at=null, rejection_note=null, rejected_by=null, rejected_at=null
     where id=existing.id returning * into cc;
  else
    insert into public.contract_completions(contract_id,requested_by,request_note)
    values(c.id,actor,nullif(btrim(coalesce(_request_note,'')),'')) returning * into cc;
  end if;

  insert into public.completion_events(completion_id,contract_id,actor,event_type,from_status,to_status,note)
  values(cc.id,c.id,actor,'requested',case when existing.id is null then null else existing.status end,'requested',left(_request_note,5000));

  if requester_is_business then
    if c.worker_id is not null then
      select wp.user_id into counterparty_user from public.worker_profiles wp where wp.id=c.worker_id;
    else
      select t.lead_user_id into counterparty_user from public.teams t where t.id=c.team_id;
    end if;
  else
    select bm.user_id into counterparty_user
    from public.business_members bm where bm.business_id=c.business_id and bm.user_id<>actor
    order by bm.user_id limit 1;
  end if;

  if counterparty_user is not null then
    insert into public.notifications(user_id,kind,text,link)
    values(counterparty_user,'completion_requested','Completion requested: '||c.title,'/dashboard');
  end if;
  return cc.id;
end;
$$;

create or replace function public.reject_completion(_contract_id uuid, _note text default null)
returns public.completion_status
language plpgsql security definer set search_path = ''
as $$
declare
  cc record; c record; actor uuid := (select auth.uid());
  requester_is_business boolean; requester_is_worker boolean; requester_is_team boolean;
  caller_is_business boolean; caller_is_worker boolean; caller_is_team boolean;
begin
  if actor is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into c from public.contracts where id=_contract_id for update;
  if not found then raise exception 'Contract not found' using errcode='P0002'; end if;
  if c.status <> 'active' then raise exception 'Only active contracts can be rejected'; end if;
  select * into cc from public.contract_completions where contract_id=_contract_id for update;
  if not found or cc.status <> 'requested' then raise exception 'No pending completion request found'; end if;

  requester_is_business := exists(select 1 from public.business_members bm where bm.business_id=c.business_id and bm.user_id=cc.requested_by);
  requester_is_worker := c.worker_id is not null and exists(select 1 from public.worker_profiles wp where wp.id=c.worker_id and wp.user_id=cc.requested_by);
  requester_is_team := c.team_id is not null and exists(select 1 from public.teams t where t.id=c.team_id and t.lead_user_id=cc.requested_by);
  if not (requester_is_business or requester_is_worker or requester_is_team) then
    raise exception 'Completion request is not owned by a contracting party' using errcode='42501';
  end if;

  caller_is_business := exists(select 1 from public.business_members bm where bm.business_id=c.business_id and bm.user_id=actor);
  caller_is_worker := c.worker_id is not null and exists(select 1 from public.worker_profiles wp where wp.id=c.worker_id and wp.user_id=actor);
  caller_is_team := c.team_id is not null and exists(select 1 from public.teams t where t.id=c.team_id and t.lead_user_id=actor);

  if requester_is_business then
    if not (caller_is_worker or caller_is_team) then raise exception 'Only the worker or team lead counterparty can reject completion' using errcode='42501'; end if;
  elsif not caller_is_business then
    raise exception 'Only the business counterparty can reject completion' using errcode='42501';
  end if;

  update public.contract_completions set status='rejected', rejection_note=nullif(btrim(coalesce(_note,'')),''),
    rejected_by=actor,rejected_at=now() where id=cc.id;
  insert into public.completion_events(completion_id,contract_id,actor,event_type,from_status,to_status,note)
  values(cc.id,_contract_id,actor,'rejected','requested','rejected',left(_note,5000));
  insert into public.notifications(user_id,kind,text,link)
  values(cc.requested_by,'completion_rejected','Completion request rejected: '||c.title,'/dashboard');
  return 'rejected';
end;
$$;

create or replace function public.confirm_completion(_contract_id uuid, _note text default null)
returns public.completion_status
language plpgsql security definer set search_path = ''
as $$
declare
  c record; cc record; actor uuid := (select auth.uid());
  caller_is_business boolean; caller_is_worker boolean; caller_is_team boolean;
  milestone_count integer; approved_count integer; ve_id uuid; completion_event_id bigint;
  subject_type text; subject_id text; other_contracts integer; milestone record;
begin
  if actor is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into c from public.contracts where id=_contract_id for update;
  if not found then raise exception 'Contract not found' using errcode='P0002'; end if;
  if c.status <> 'active' then raise exception 'Only active contracts can be confirmed'; end if;
  select * into cc from public.contract_completions where contract_id=c.id for update;
  if not found or cc.status <> 'requested' then raise exception 'No pending completion request found'; end if;
  if cc.requested_by=actor then raise exception 'Requester cannot confirm their own completion request' using errcode='42501'; end if;

  caller_is_business := exists(select 1 from public.business_members bm where bm.business_id=c.business_id and bm.user_id=actor);
  caller_is_worker := c.worker_id is not null and exists(select 1 from public.worker_profiles wp where wp.id=c.worker_id and wp.user_id=actor);
  caller_is_team := c.team_id is not null and exists(select 1 from public.teams t where t.id=c.team_id and t.lead_user_id=actor);
  if not (caller_is_business or caller_is_worker or caller_is_team) then
    raise exception 'Only the contracting counterparty can confirm' using errcode='42501';
  end if;

  select count(*)::integer, count(*) filter(where status='approved')::integer into milestone_count,approved_count
  from public.milestones where contract_id=c.id;
  if milestone_count>0 and approved_count<>milestone_count then raise exception 'All milestones must be approved before completion can be confirmed'; end if;

  update public.contract_completions set status='confirmed',confirmed_by=actor,confirmed_at=now(),completed_at=now() where id=cc.id;
  update public.contracts set status='completed',completed_at=now() where id=c.id;

  insert into public.completion_events(completion_id,contract_id,actor,event_type,from_status,to_status,note)
  values(cc.id,c.id,actor,'confirmed','requested','confirmed',left(_note,5000)) returning id into completion_event_id;
  insert into public.contract_events(contract_id,actor,event_type,from_status,to_status,note)
  values(c.id,actor,'completed','active','completed',left(_note,1000));

  if c.worker_id is not null then subject_type='worker'; subject_id=c.worker_id;
  else subject_type='team'; subject_id=c.team_id; end if;

  insert into public.verified_experiences(
    contract_id,completion_id,opportunity_id,business_id,worker_id,team_id,title,scope,amount_rwf,currency,
    start_date,end_date,completed_at,milestone_count,approved_milestone_count,verified_at
  ) values(
    c.id,cc.id,c.opportunity_id,c.business_id,c.worker_id,c.team_id,c.title,c.scope,c.amount_rwf,c.currency,
    c.start_date,c.end_date,now(),milestone_count,approved_count,now()
  ) returning id into ve_id;

  insert into public.reputation_evidence(subject_type,subject_id,evidence_type,source_contract_id,source_experience_id,source_event_id,occurred_at,metadata)
  values(subject_type,subject_id,'verified_project_completed',c.id,ve_id,completion_event_id,now(),jsonb_build_object('milestone_count',milestone_count));

  if c.end_date is not null and now()::date<=c.end_date then
    insert into public.reputation_evidence(subject_type,subject_id,evidence_type,source_contract_id,source_experience_id,source_event_id,occurred_at,metadata)
    values(subject_type,subject_id,'verified_on_time_completion',c.id,ve_id,completion_event_id,now(),'{}'::jsonb);
  end if;

  for milestone in select m.id,m.approved_at from public.milestones m where m.contract_id=c.id and m.status='approved' loop
    insert into public.reputation_evidence(subject_type,subject_id,evidence_type,source_contract_id,source_experience_id,source_event_id,occurred_at,metadata)
    select subject_type,subject_id,'verified_milestone_completion',c.id,ve_id,me.id,coalesce(milestone.approved_at,now()),jsonb_build_object('milestone_id',milestone.id)
    from public.milestone_events me where me.milestone_id=milestone.id and me.event_type='approved'
    order by me.at desc limit 1 on conflict do nothing;
  end loop;

  select count(*)::integer into other_contracts from public.contracts prior
  where prior.business_id=c.business_id and prior.status='completed' and prior.id<>c.id
    and ((subject_type='worker' and prior.worker_id=subject_id) or (subject_type='team' and prior.team_id=subject_id));
  if other_contracts>0 then
    insert into public.reputation_evidence(subject_type,subject_id,evidence_type,source_contract_id,source_experience_id,occurred_at,metadata)
    values(subject_type,subject_id,'repeat_employer_relationship',c.id,ve_id,now(),jsonb_build_object('prior_completed_contracts',other_contracts))
    on conflict do nothing;
  end if;

  insert into public.notifications(user_id,kind,text,link)
  select bm.user_id,'completion_confirmed','Contract completed: '||c.title,'/dashboard' from public.business_members bm where bm.business_id=c.business_id;

  if c.worker_id is not null then
    insert into public.notifications(user_id,kind,text,link)
    select wp.user_id,'completion_confirmed','Contract completed: '||c.title,'/dashboard' from public.worker_profiles wp where wp.id=c.worker_id and wp.user_id is not null;
    insert into public.notifications(user_id,kind,text,link)
    select wp.user_id,'verified_experience_created','Verified work history created: '||c.title,'/dashboard' from public.worker_profiles wp where wp.id=c.worker_id and wp.user_id is not null;
  else
    insert into public.notifications(user_id,kind,text,link)
    select t.lead_user_id,'completion_confirmed','Team contract completed: '||c.title,'/dashboard' from public.teams t where t.id=c.team_id and t.lead_user_id is not null;
    insert into public.notifications(user_id,kind,text,link)
    select t.lead_user_id,'verified_experience_created','Verified team experience created: '||c.title,'/dashboard' from public.teams t where t.id=c.team_id and t.lead_user_id is not null;
  end if;
  return 'confirmed';
end;
$$;