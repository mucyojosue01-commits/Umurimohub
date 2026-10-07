-- Phase C completion, verified experience and reputation security tests.
-- Run inside one transaction; final RAISE rolls back all fixtures.

create or replace function pg_temp.as_user(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.as_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.fails(_sql text) returns boolean language plpgsql as $$
begin
  execute _sql;
  return false;
exception when others then
  return true;
end $$;

create or replace function pg_temp.check(_ok boolean, _name text) returns void language plpgsql as $$
begin
  if not coalesce(_ok, false) then raise exception 'FAILED: %', _name; end if;
end $$;

do $$
declare
  biz uuid := '00000000-0000-4000-a000-0000000000b1';
  worker uuid := '00000000-0000-4000-a000-0000000000a1';
  lead uuid := '00000000-0000-4000-a000-0000000000c1';
  member uuid := '00000000-0000-4000-a000-0000000000c2';
  outsider uuid := '00000000-0000-4000-a000-0000000000d1';
  app_id uuid;
  gated_app uuid;
  team_app uuid;
  cid uuid;
  gated_cid uuid;
  team_cid uuid;
  completion_id uuid;
  milestone_id uuid;
  st text;
begin
  insert into businesses(id,name,sector,district,verified,rating,about,services,is_demo,created_by)
    values ('c_biz','Completion Test Biz','Construction','Gasabo',false,0,'x','{}',false,biz);
  insert into business_members values ('c_biz', biz, 'owner');

  insert into opportunities(
    id,business_id,created_by,title,sector,district,type,pay_rwf,pay_unit,mode,duration,
    deadline,team_allowed,team_size,skills,summary,responsibilities,requirements,featured,status,is_demo
  ) values
    ('c_opp','c_biz',biz,'Completion Job','Construction','Gasabo','Project',1000000,'project',
     'On-site','1 month',current_date+30,false,1,'{}','s','{}','{}',false,'open',false),
    ('c_team_opp','c_biz',biz,'Team Completion Job','Construction','Gasabo','Project',1500000,'project',
     'On-site','1 month',current_date+30,true,3,'{}','s','{}','{}',false,'open',false);

  insert into worker_profiles(id,user_id,name,title,district,sector,rate_rwf,rate_unit,available,years,bio,initials,verified,rating,reviews,rep,visibility,is_demo)
    values
      ('c_worker',worker,'Completion Worker','Mason','Gasabo','Construction',10000,'day',true,2,'b','CW',false,0,0,'{}'::jsonb,'public',false),
      ('c_member',member,'Team Member','Mason','Gasabo','Construction',10000,'day',true,2,'b','TM',false,0,0,'{}'::jsonb,'public',false);

  insert into teams(id,name,lead_user_id,lead_worker_id,sector,areas,rating,projects,available,summary,skills,is_demo)
    values ('c_team','Completion Team',lead,'c_worker','Construction','{}',0,0,true,'s','{}',false);
  insert into team_members(team_id,worker_id,role,status) values ('c_team','c_worker','lead','active'),('c_team','c_member','member','active');

  insert into applications(opportunity_id,applicant_user_id,kind,note,status)
    values ('c_opp',worker,'Individual','n','accepted')
    returning id into app_id;
  insert into applications(opportunity_id,applicant_user_id,team_id,kind,note,status)
    values ('c_team_opp',lead,'c_team','Team','n','accepted')
    returning id into team_app;
  insert into applications(opportunity_id,applicant_user_id,kind,note,status)
    values ('c_opp',worker,'Individual','gated','accepted')
    returning id into gated_app;

  perform pg_temp.as_user(biz);
  cid := public.create_contract(app_id,'Direct Completion','Complete the construction scope',500000,current_date,current_date+10,null);
  gated_cid := public.create_contract(
    gated_app,'Gated Completion','Complete the gated scope',500000,current_date,current_date+10,null
  );
  team_cid := public.create_contract(team_app,'Team Completion','Complete the team scope',800000,current_date,current_date+10,null);

  perform pg_temp.as_user(worker);
  perform pg_temp.check(public.respond_contract(cid,true) = 'active', 'direct contract active');
  perform pg_temp.check(public.respond_contract(gated_cid,true) = 'active', 'gated contract active');

  perform pg_temp.as_user(lead);
  perform pg_temp.check(public.respond_contract(team_cid,true) = 'active', 'team contract active');

  -- Zero-milestone completion request is allowed.
  perform pg_temp.as_user(worker);
  completion_id := public.request_completion(cid,'Ready for final confirmation');
  perform pg_temp.check(
    (select status = 'requested' and requested_by = worker from contract_completions where id = completion_id),
    'worker can request direct completion'
  );

  -- Requester cannot confirm, outsider cannot confirm.
  perform pg_temp.check(pg_temp.fails(format($q$select public.confirm_completion(%L)$q$, cid)), 'requester cannot self-confirm');
  perform pg_temp.as_user(outsider);
  perform pg_temp.check(pg_temp.fails(format($q$select public.confirm_completion(%L)$q$, cid)), 'outsider cannot confirm');

  -- Counterparty rejects; contract remains active and a new request is allowed.
  perform pg_temp.as_user(biz);
  st := public.reject_completion(cid,'Please finish the last inspection.');
  perform pg_temp.check(st = 'rejected', 'business rejects request');
  perform pg_temp.check((select status = 'active' from contracts where id = cid), 'rejection leaves contract active');

  completion_id := public.request_completion(cid,'Inspection completed');
  perform pg_temp.check((select status = 'requested' from contract_completions where id = completion_id), 'new request after rejection');

  -- Counterparty confirmation atomically completes contract and creates one experience.
  perform pg_temp.as_user(worker);
  st := public.confirm_completion(cid,'Confirmed complete');
  perform pg_temp.check(st = 'confirmed', 'worker confirms business request');
  perform pg_temp.check((select status = 'completed' from contracts where id = cid), 'contract becomes completed');
  perform pg_temp.check((select count(*) = 1 from verified_experiences where contract_id = cid), 'one verified experience');
  perform pg_temp.check(
    (select count(*) = 1 from reputation_evidence where source_contract_id = cid and evidence_type='verified_project_completed'),
    'verified project evidence'
  );
  perform pg_temp.check(
    (select count(*) = 1 from reputation_evidence where source_contract_id = cid and evidence_type='verified_on_time_completion'),
    'on-time evidence'
  );

  -- Finalized history is immutable to normal clients.
  perform pg_temp.check(pg_temp.fails(format($q$update contract_completions set request_note='tampered' where id=%L$q$, completion_id)), 'completion immutable after finalize');
  perform pg_temp.check(pg_temp.fails(format($q$delete from completion_events where completion_id=%L$q$, completion_id)), 'completion events immutable');
  perform pg_temp.check(pg_temp.fails(format($q$update verified_experiences set title='tampered' where contract_id=%L$q$, cid)), 'verified experience immutable');
  perform pg_temp.check(pg_temp.fails(format($q$delete from reputation_evidence where source_contract_id=%L$q$, cid)), 'reputation evidence immutable');
  perform pg_temp.check(pg_temp.fails(format($q$select public.request_completion(%L)$q$, cid)), 'completed contract cannot request again');

  -- Milestone gate blocks completion until every milestone is approved.
  perform pg_temp.as_user(biz);
  milestone_id := public.create_milestone(gated_cid,1,'Gate','Complete gated work before final confirmation.',300000,current_date+5);
  perform pg_temp.as_user(worker);
  perform pg_temp.check(pg_temp.fails(format($q$select public.request_completion(%L,'not ready')$q$, gated_cid)), 'incomplete milestone blocks request');
  st := public.submit_milestone(milestone_id,'Gated work ready');
  perform pg_temp.check(st='submitted','gated milestone submitted');
  perform pg_temp.as_user(biz);
  perform pg_temp.check(public.approve_milestone(milestone_id)='approved','gated milestone approved');
  perform pg_temp.as_user(worker);
  perform pg_temp.check(public.request_completion(gated_cid,'Now ready') is not null,'request allowed after milestone approval');

  -- Team authority belongs to the lead, not ordinary team members.
  perform pg_temp.as_user(member);
  perform pg_temp.check(pg_temp.fails(format($q$select public.request_completion(%L,'member')$q$, team_cid)), 'ordinary team member cannot request');
  perform pg_temp.as_user(lead);
  completion_id := public.request_completion(team_cid,'Team work ready');
  perform pg_temp.as_user(member);
  perform pg_temp.check(pg_temp.fails(format($q$select public.confirm_completion(%L)$q$, team_cid)), 'ordinary team member cannot confirm');

  perform pg_temp.as_owner();
  perform pg_temp.check(
    (select count(*) from completion_events where contract_id = cid and event_type in ('requested','withdrawn','rejected','confirmed')) = 4,
    'completion event ledger preserved'
  );

  raise exception 'ALL PHASE C TESTS PASSED (rolled back)';
end $$;
