-- Contracts Phase A database tests. Runs fully inside one transaction and always
-- rolls back: the final RAISE reports the result and undoes every row it created.
-- Uses fixed fake user ids (no auth.users rows needed; public tables do not FK auth).
create or replace function pg_temp.as_user(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function pg_temp.as_owner() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.fails(_sql text) returns boolean language plpgsql as $$
begin execute _sql; return false; exception when others then return true; end $$;
create or replace function pg_temp.check(_ok boolean, _name text) returns void language plpgsql as $$
begin if not coalesce(_ok, false) then raise exception 'FAILED: %', _name; end if; end $$;

do $$
declare
  biz uuid := '00000000-0000-4000-a000-0000000000b1';
  wk uuid := '00000000-0000-4000-a000-0000000000a1';
  lead uuid := '00000000-0000-4000-a000-0000000000c1';
  outsider uuid := '00000000-0000-4000-a000-0000000000d1';
  a1 uuid; a2 uuid; c1 uuid; c2 uuid; n int; st text;
begin
  -- Fixtures
  insert into businesses(id,name,sector,district,verified,rating,about,services,is_demo,created_by)
    values ('t_biz','Test Biz','Construction','Gasabo',false,0,'x','{}',false,biz);
  insert into business_members values ('t_biz', biz, 'owner');
  insert into opportunities(id,business_id,created_by,title,sector,district,type,pay_rwf,pay_unit,mode,duration,deadline,team_allowed,team_size,skills,summary,responsibilities,requirements,featured,status,is_demo)
    values ('t_opp','t_biz',biz,'Test job','Construction','Gasabo','Project',100000,'project','On-site','1 month',current_date+30,true,3,'{}','s','{}','{}',false,'open',false);
  insert into worker_profiles(id,user_id,name,title,district,sector,rate_rwf,rate_unit,available,years,bio,initials,verified,rating,reviews,rep,visibility,is_demo)
    values ('t_w',wk,'Test Worker','Mason','Gasabo','Construction',10000,'day',true,2,'b','TW',false,0,0,'{}'::jsonb,'public',false);
  insert into teams(id,name,lead_user_id,sector,areas,rating,projects,available,summary,skills,is_demo)
    values ('t_team','Test Team',lead,'Construction','{}',0,0,true,'s','{}',false);
  insert into applications(opportunity_id,applicant_user_id,kind,note,status) values ('t_opp',wk,'Individual','n','submitted') returning id into a1;
  insert into applications(opportunity_id,applicant_user_id,team_id,kind,note,status) values ('t_opp',lead,'t_team','Team','n','submitted') returning id into a2;

  -- Only accepted applications, only by business members
  perform pg_temp.as_user(biz);
  perform pg_temp.check(pg_temp.fails(format($q$select public.create_contract(%L,'Title','Scope of the work',1000)$q$, a1)), 'not-accepted application rejected');
  perform pg_temp.as_user(outsider);
  perform pg_temp.check(pg_temp.fails(format($q$update applications set status='accepted' where id=%L$q$, a1)) or
    (select count(*) from applications where id = a1) = 0, 'outsider cannot see/accept application');
  perform pg_temp.as_user(biz);
  update applications set status = 'accepted' where id in (a1, a2);
  perform pg_temp.as_owner();
  select count(*) into n from notifications where user_id = wk and kind = 'application_accepted';
  perform pg_temp.check(n = 1, 'application accepted notification');

  perform pg_temp.as_user(outsider);
  perform pg_temp.check(pg_temp.fails(format($q$select public.create_contract(%L,'Title','Scope of the work',1000)$q$, a1)), 'outsider cannot create');
  perform pg_temp.as_user(wk);
  perform pg_temp.check(pg_temp.fails(format($q$select public.create_contract(%L,'Title','Scope of the work',1000)$q$, a1)), 'applicant cannot create');

  perform pg_temp.as_user(biz);
  perform pg_temp.check(pg_temp.fails(format($q$select public.create_contract(%L,'Title','Scope of the work',0)$q$, a1)), 'zero amount rejected');
  perform pg_temp.check(pg_temp.fails(format($q$select public.create_contract(%L,'Title','Scope of the work',1000,'2026-12-10','2026-12-01')$q$, a1)), 'end before start rejected');
  c1 := public.create_contract(a1, 'Wall build', 'Build the boundary wall', 1500000, current_date, current_date + 20, null);
  perform pg_temp.check(pg_temp.fails(format($q$select public.create_contract(%L,'Again','Scope of the work',1000)$q$, a1)), 'duplicate contract rejected');
  perform pg_temp.check(pg_temp.fails($q$insert into contracts(application_id,opportunity_id,business_id,worker_id,title,scope,amount_rwf,proposed_by) values (gen_random_uuid(),'t_opp','t_biz','t_w','Title','Scope here ok',1,auth.uid())$q$), 'direct insert denied');
  perform pg_temp.check(pg_temp.fails(format($q$update contracts set amount_rwf = 1 where id=%L$q$, c1)), 'direct amount edit denied');
  perform pg_temp.check(pg_temp.fails(format($q$update contracts set status='active' where id=%L$q$, c1)), 'direct status edit denied');
  perform pg_temp.check(pg_temp.fails(format($q$select public.respond_contract(%L,true)$q$, c1)), 'business cannot accept own proposal');

  -- Visibility
  perform pg_temp.as_user(wk);
  perform pg_temp.check((select count(*) from contracts where id = c1) = 1, 'worker reads own contract');
  perform pg_temp.as_user(outsider);
  perform pg_temp.check((select count(*) from contracts) = 0, 'outsider sees no contracts');
  perform pg_temp.check((select count(*) from contract_events) = 0, 'outsider sees no events');
  perform pg_temp.check(pg_temp.fails(format($q$select public.respond_contract(%L,true)$q$, c1)), 'outsider cannot respond');
  perform pg_temp.check(pg_temp.fails(format($q$select public.cancel_contract(%L)$q$, c1)), 'outsider cannot cancel');

  -- Worker accepts: proposed -> active
  perform pg_temp.as_user(wk);
  perform pg_temp.check((select count(*) from notifications where kind='contract_proposed') = 1, 'proposal notification');
  st := public.respond_contract(c1, true, 'Ready to start');
  perform pg_temp.check(st = 'active', 'accept makes active');
  perform pg_temp.check((select accepted_at is not null and activated_at is not null from contracts where id=c1), 'lifecycle timestamps');
  perform pg_temp.check((select count(*) from contract_events where contract_id = c1) = 3, 'event history proposed/accepted/activated');
  perform pg_temp.check(pg_temp.fails(format($q$select public.respond_contract(%L,false)$q$, c1)), 'cannot respond twice');
  perform pg_temp.as_user(biz);
  perform pg_temp.check((select count(*) from notifications where kind='contract_accepted') = 1, 'accepted notification to business');

  -- Team contract: only the team lead may respond
  c2 := public.create_contract(a2, 'Team job', 'Whole crew delivers this', 3000000);
  perform pg_temp.check((select team_id = 't_team' and worker_id is null from contracts where id=c2), 'team counterparty');
  perform pg_temp.as_user(wk);
  perform pg_temp.check((select count(*) from contracts where id=c2) = 0, 'non-lead cannot see team contract');
  perform pg_temp.check(pg_temp.fails(format($q$select public.respond_contract(%L,true)$q$, c2)), 'non-lead cannot respond');
  perform pg_temp.as_user(lead);
  perform pg_temp.check((select count(*) from contracts where id=c2) = 1, 'lead reads team contract');
  st := public.respond_contract(c2, false, 'Dates do not work');
  perform pg_temp.check(st = 'declined', 'lead declines');
  perform pg_temp.as_user(biz);
  perform pg_temp.check(pg_temp.fails(format($q$select public.cancel_contract(%L)$q$, c2)), 'declined is terminal');
  perform pg_temp.check((select count(*) from notifications where kind='contract_declined') = 1, 'declined notification');

  -- Cancel active
  st := public.cancel_contract(c1, 'Budget change');
  perform pg_temp.check(st = 'cancelled', 'business cancels active');
  perform pg_temp.check(pg_temp.fails(format($q$select public.cancel_contract(%L)$q$, c1)), 'cannot cancel twice');
  perform pg_temp.as_user(wk);
  perform pg_temp.check((select count(*) from notifications where kind='contract_cancelled') = 1, 'cancel notification');
  perform pg_temp.check(pg_temp.fails($q$update notifications set text='x'$q$), 'notification text not editable');

  -- Even privileged writers cannot rewrite history or terms
  perform pg_temp.as_owner();
  perform pg_temp.check(pg_temp.fails(format($q$update contract_events set note='x' where contract_id=%L$q$, c1)), 'events immutable');
  perform pg_temp.check(pg_temp.fails(format($q$delete from contract_events where contract_id=%L$q$, c1)), 'events undeletable');
  perform pg_temp.check(pg_temp.fails(format($q$update contracts set amount_rwf=1 where id=%L$q$, c2)), 'terms immutable for owner');
  perform pg_temp.check(pg_temp.fails(format($q$update contracts set status='active' where id=%L$q$, c1)), 'cancelled -> active invalid');
  perform pg_temp.check(pg_temp.fails(format($q$delete from contracts where id=%L$q$, c1)), 'contracts undeletable');

  raise exception 'ALL CONTRACT TESTS PASSED (rolled back)';
end $$;
