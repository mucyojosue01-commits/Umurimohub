-- Employment offer regression test. The final exception rolls back every fixture.
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
  biz uuid := '00000000-0000-4000-a000-0000000000f5';
  worker uuid := '00000000-0000-4000-a000-0000000000f6';
  outsider uuid := '00000000-0000-4000-a000-0000000000f7';
  application_id uuid := '00000000-0000-4000-a000-0000000000f8';
  offer_id uuid;
  app_status text;
  offer_status text;
begin
  insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (biz,'authenticated','authenticated','employment-test-biz@example.test','{}'::jsonb,'{}'::jsonb,now(),now()),
    (worker,'authenticated','authenticated','employment-test-worker@example.test','{}'::jsonb,'{}'::jsonb,now(),now()),
    (outsider,'authenticated','authenticated','employment-test-outsider@example.test','{}'::jsonb,'{}'::jsonb,now(),now())
  on conflict do nothing;

  insert into public.businesses(id,name,sector,district,verified,rating,about,services,is_demo,created_by)
  values ('employment-test-biz','Employment Test Biz','Construction','Gasabo',false,0,'test','{}',false,biz);
  insert into public.business_members(business_id,user_id,role)
  values ('employment-test-biz',biz,'owner');
  insert into public.worker_profiles
    (id,user_id,name,title,district,sector,rate_rwf,rate_unit,available,years,bio,initials,verified,rating,reviews,rep,visibility,is_demo)
  values
    ('employment-test-worker',worker,'Employment Test Worker','Mason','Gasabo','Construction',10000,'day',true,1,'test','ET',false,0,0,'{}'::jsonb,'public',false);
  insert into public.opportunities
    (id,business_id,created_by,title,sector,district,type,position_name,pay_rwf,pay_unit,mode,duration,deadline,team_allowed,team_size,skills,summary,responsibilities,requirements,featured,status,is_demo)
  values
    ('employment-test-job','employment-test-biz',biz,'Employment Test Position','Construction','Gasabo','Job','Mason',10000,'day','On-site','6 months',current_date+30,false,1,'{}','test','{}','{}',false,'open',false);
  insert into public.applications
    (id,opportunity_id,applicant_user_id,applicant_type,kind,note,status)
  values
    (application_id,'employment-test-job',worker,'individual','Individual','test application','submitted');

  perform pg_temp.as_user(outsider);
  perform pg_temp.check(
    pg_temp.fails(format('select public.set_position_application_status(%L,''offer'')', application_id)),
    'unrelated user cannot issue employment offer'
  );
  perform pg_temp.as_owner();
  perform pg_temp.check(
    (select count(*)=0 from public.employment_offers where application_id=application_id),
    'unauthorized user created no offer'
  );

  perform pg_temp.as_user(biz);
  select (public.set_position_application_status(application_id,'offer',null,'full_time','Employment test offer')).status
    into app_status;
  perform pg_temp.check(app_status='offer','business member moves application to offer');
  perform pg_temp.as_owner();
  select id into offer_id from public.employment_offers where application_id=application_id and status='pending';
  perform pg_temp.check(offer_id is not null,'pending offer created');
  perform pg_temp.check(
    (select status='offer' from public.applications where id=application_id),
    'application status follows offer'
  );

  perform pg_temp.as_user(outsider);
  perform pg_temp.check(
    pg_temp.fails(format('select public.respond_to_employment_offer(%L,''accepted'')', offer_id)),
    'unrelated user cannot accept offer'
  );
  perform pg_temp.as_owner();
  perform pg_temp.check(
    (select status='pending' from public.employment_offers where id=offer_id),
    'unauthorized response leaves offer pending'
  );

  perform pg_temp.as_user(worker);
  select (public.respond_to_employment_offer(offer_id,'accepted')).status into offer_status;
  perform pg_temp.check(offer_status='accepted','invited worker accepts offer');

  perform pg_temp.as_owner();
  perform pg_temp.check(
    (select count(*)=1 from public.company_employments where offer_id=offer_id and status='active'),
    'acceptance creates one active employment'
  );
  perform pg_temp.check(
    (select status='closed' from public.opportunities where id='employment-test-job'),
    'accepted offer closes the job position'
  );
  perform pg_temp.check(
    (select status='accepted' from public.applications where id=application_id),
    'accepted offer closes the application successfully'
  );
  perform pg_temp.check(
    (select count(*)=1 from public.notifications where user_id=biz and kind='employment_accepted'),
    'business notified when worker accepts'
  );
  perform pg_temp.check(
    pg_temp.fails(format('select public.respond_to_employment_offer(%L,''accepted'')', offer_id)),
    'offer cannot be accepted twice'
  );

  raise exception 'ALL EMPLOYMENT OFFER TESTS PASSED (rolled back)';
end $$;
