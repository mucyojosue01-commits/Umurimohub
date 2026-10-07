-- Phase C completion, experience, and reputation security tests.
-- Intended to run in a transaction and roll back all fixtures.

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
begin if not coalesce(_ok,false) then raise exception 'FAILED: %', _name; end if; end $$;

do $$
declare
  biz uuid := '00000000-0000-4000-a000-0000000000b1';
  worker uuid := '00000000-0000-4000-a000-0000000000a1';
  outsider uuid := '00000000-0000-4000-a000-0000000000d1';
  app_id uuid;
  cid uuid;
  mid uuid;
  ccid uuid;
  st text;
  n int;
begin
  insert into businesses(id,name,sector,district,verified,rating,about,services,is_demo,created_by)
  values ('c_biz','Completion Test Biz','Construction','Gasabo',false,0,'x','{}',false,biz);
  insert into business_members values ('c_biz',biz,'owner');
  insert into opportunities(id,business_id,created_by,title,sector,district,type,pay_rwf,pay_unit,mode,duration,deadline,team_allowed,team_size,skills,summary,responsibilities,requirements,featured,status,is_demo)
  values ('c_opp','c_biz',biz,'Completion Test Job','Construction','Gasabo','Project',1000000,'project','On-site','1 month',current_date+30,false,1,'{}','s','{}','{}',false,'open',false);
  insert into worker_profiles(id,user_id,name,title,district,sector,rate_rwf,rate_unit,available,years,bio,initials,verified,rating,reviews,rep,visibility,is_demo)
  values ('c_worker',worker,'Completion Worker','Mason','Gasabo','Construction',10000,'day',true,2,'b','CW',false,0,0,'{}'::jsonb,'public',false);
  insert into applications(opportunity_id,applicant_user_id,kind,note,status)
  values ('c_opp',worker,'Individual','n','accepted') returning id into app_id;

  perform pg_temp.as_user(biz);
  cid := public.create_contract(app_id,'Completion Contract','Deliver the work',900000,current_date,current_date+10);
  perform pg_temp.as_user(worker);
  st := public.respond_contract(cid,true);
  perform pg_temp.check(st='active','contract active');

  -- An active contract with a pending milestone cannot request completion.
  perform pg_temp.as_user(biz);
  mid := public.create_milestone(cid,1,'Foundation','Complete foundation',400000,current_date+5);
  perform pg_temp.as_user(worker);
  perform pg_temp.check(pg_temp.fails(format($q$select public.request_completion(%L,'done')$q$,cid)),'milestone gate blocks request');

  -- Outsider cannot mutate or read the completion record.
  perform pg_temp.as_user(outsider);
  perform pg_temp.check(pg_temp.fails(format($q$select public.request_completion(%L,'x')$q$,cid)),'outsider cannot request');
  perform pg_temp.check(pg_temp.fails(format($q$select public.confirm_completion(%L,'x')$q$,cid)),'outsider cannot confirm');

  -- Submit/approve milestone, then request.
  perform pg_temp.as_user(worker);
  st := public.submit_milestone(mid,'finished');
  perform pg_temp.as_user(biz);
  st := public.approve_milestone(mid);
  perform pg_temp.check(st='approved','milestone approved');

  ccid := public.request_completion(cid,'All work is ready for confirmation.');
  perform pg_temp.check((select status='requested' from contract_completions where id=ccid),'request persisted');

  -- Requester cannot confirm their own completion.
  perform pg_temp.check(pg_temp.fails(format($q$select public.confirm_completion(%L,'self')$q$,cid)),'self-confirm blocked');

  -- Worker is counterparty and can confirm.
  perform pg_temp.as_user(worker);
  st := public.confirm_completion(cid,'Confirmed.');
  perform pg_temp.check(st='confirmed','counterparty confirms');
  perform pg_temp.check((select status='completed' from contracts where id=cid),'contract completed');
  perform pg_temp.check((select count(*)=1 from verified_experiences where contract_id=cid),'one verified experience');
  perform pg_temp.check((select count(*)>=1 from reputation_evidence where source_contract_id=cid),'completion evidence created');

  -- History is immutable and evidence cannot be self-created.
  perform pg_temp.check(pg_temp.fails(format($q$delete from verified_experiences where contract_id=%L$q$,cid)),'verified experience cannot delete');
  perform pg_temp.check(pg_temp.fails(format($q$delete from reputation_evidence where source_contract_id=%L$q$,cid)),'evidence cannot delete');

  perform pg_temp.as_owner();
  select count(*) into n from completion_events where contract_id=cid;
  perform pg_temp.check(n=2,'request and confirmation events recorded');

  raise exception 'ALL PHASE C TESTS PASSED (rolled back)';
end $$;