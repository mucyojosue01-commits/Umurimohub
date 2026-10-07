-- Milestones Phase B database tests.
-- Run inside one transaction; the final RAISE rolls back all fixtures.
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
  outsider uuid := '00000000-0000-4000-a000-0000000000d1';
  app_id uuid;
  cid uuid;
  milestone_id uuid;
  milestone_id_2 uuid;
  status text;
  total bigint;
begin
  insert into businesses(id,name,sector,district,verified,rating,about,services,is_demo,created_by)
    values ('m_biz','Milestone Test Biz','Construction','Gasabo',false,0,'x','{}',false,biz);
  insert into business_members values ('m_biz', biz, 'owner');
  insert into opportunities(id,business_id,created_by,title,sector,district,type,pay_rwf,pay_unit,mode,duration,deadline,team_allowed,team_size,skills,summary,responsibilities,requirements,featured,status,is_demo)
    values ('m_opp','m_biz',biz,'Milestone Test Job','Construction','Gasabo','Project',1500000,'project','On-site','1 month',current_date+30,false,1,'{}','s','{}','{}',false,'open',false);
  insert into worker_profiles(id,user_id,name,title,district,sector,rate_rwf,rate_unit,available,years,bio,initials,verified,rating,reviews,rep,visibility,is_demo)
    values ('m_worker',worker,'Milestone Worker','Mason','Gasabo','Construction',10000,'day',true,2,'b','MW',false,0,0,'{}'::jsonb,'public',false);
  insert into applications(opportunity_id,applicant_user_id,kind,note,status)
    values ('m_opp',worker,'Individual','n','accepted')
    returning id into app_id;

  perform pg_temp.as_user(biz);
  cid := public.create_contract(app_id,'Milestone Contract','Deliver the construction scope',1000000);
  perform pg_temp.as_user(worker);
  status := public.respond_contract(cid, true);
  perform pg_temp.check(status = 'active', 'contract is active');

  perform pg_temp.as_user(biz);
  milestone_id := public.create_milestone(
    cid, 1, 'Foundation', 'Complete the foundation and handover.', 400000, current_date + 7
  );
  perform pg_temp.check((select status = 'pending' from milestones where id = milestone_id), 'created pending');

  milestone_id_2 := public.create_milestone(
    cid, 2, 'Walls', 'Complete the walls and handover.', 300000, current_date + 14
  );
  perform pg_temp.check((select count(*) from milestones where milestones.contract_id = cid) = 2, 'two milestones created');

  perform pg_temp.check(
    pg_temp.fails(format(
      $q$select public.create_milestone(%L,3,'Roof','Complete the roof and handover.',400001,current_date+21)$q$,
      cid
    )),
    'contract ceiling enforced'
  );

  perform pg_temp.check(
    pg_temp.fails(format(
      $q$select public.create_milestone(%L,2,'Duplicate','Duplicate sequence should fail.',100000,current_date+20)$q$,
      cid
    )),
    'duplicate sequence rejected'
  );

  perform pg_temp.check(
    pg_temp.fails(format(
      $q$insert into milestones(contract_id,sequence,title,description,amount_rwf,due_date) values (%L,3,'Direct','Direct insert is blocked.',1,current_date+20)$q$,
      cid
    )),
    'direct milestone insert denied'
  );

  perform pg_temp.as_user(outsider);
  perform pg_temp.check((select count(*) from milestones) = 0, 'outsider cannot read milestones');
  perform pg_temp.check((select count(*) from milestone_events) = 0, 'outsider cannot read events');
  perform pg_temp.check(
    pg_temp.fails(format(
      $q$select public.submit_milestone(%L,'x')$q$,
      milestone_id
    )),
    'outsider cannot submit'
  );

  perform pg_temp.as_user(worker);
  status := public.submit_milestone(milestone_id, 'Foundation completed and ready for review.');
  perform pg_temp.check(status = 'submitted', 'worker submits pending milestone');
  perform pg_temp.check(
    (select count(*) from milestone_events where milestone_events.milestone_id = milestone_id and event_type = 'submitted') = 1,
    'submission event recorded'
  );
  perform pg_temp.check(
    pg_temp.fails(format($q$select public.approve_milestone(%L)$q$, milestone_id)),
    'worker cannot approve'
  );

  perform pg_temp.as_user(biz);
  status := public.dispute_milestone(milestone_id, 'Please correct the drainage detail.');
  perform pg_temp.check(status = 'disputed', 'business disputes submission');

  perform pg_temp.check(
    pg_temp.fails(format($q$select public.approve_milestone(%L)$q$, milestone_id)),
    'disputed milestone cannot approve'
  );

  perform pg_temp.as_user(worker);
  status := public.submit_milestone(milestone_id, 'Drainage detail corrected and resubmitted.');
  perform pg_temp.check(status = 'submitted', 'worker resubmits disputed work');

  perform pg_temp.as_user(biz);
  status := public.approve_milestone(milestone_id);
  perform pg_temp.check(status = 'approved', 'business approves submission');
  perform pg_temp.check(
    (select approved_at is not null from milestones where id = milestone_id),
    'approval timestamp recorded'
  );

  perform pg_temp.check(
    pg_temp.fails(format(
      $q$select public.submit_milestone(%L,'again')$q$,
      milestone_id
    )),
    'approved milestone cannot resubmit'
  );
  perform pg_temp.check(
    pg_temp.fails(format(
      $q$update milestones set amount_rwf=1 where id=%L$q$,
      milestone_id
    )),
    'approved milestone cannot be edited'
  );
  perform pg_temp.check(
    pg_temp.fails(format(
      $q$delete from milestones where id=%L$q$,
      milestone_id
    )),
    'approved milestone cannot be deleted'
  );

  perform pg_temp.as_owner();
  select coalesce(sum(m.amount_rwf),0) into total from milestones m where m.contract_id = cid;
  perform pg_temp.check(total = 700000, 'milestone totals preserved');
  perform pg_temp.check(
    (select count(*) from milestone_events where milestone_events.contract_id = cid) = 6,
    'created/submitted/disputed/resubmitted/approved history recorded'
  );
  perform pg_temp.check(
    pg_temp.fails(format(
      $q$update milestone_events set note='tampered' where milestone_id=%L$q$,
      milestone_id
    )),
    'milestone events immutable'
  );
  perform pg_temp.check(
    pg_temp.fails(format(
      $q$delete from milestone_events where milestone_id=%L$q$,
      milestone_id
    )),
    'milestone events undeletable'
  );

  raise exception 'ALL MILESTONE TESTS PASSED (rolled back)';
end $$;
