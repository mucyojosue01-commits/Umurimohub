-- Production integrity regression tests.
-- Run in a transaction; all fixture writes are rolled back.

create or replace function pg_temp.as_user(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.fails(_sql text) returns boolean language plpgsql as $$
begin
  execute _sql;
  return false;
exception when others then
  return true;
end $$;

begin;

do $$
declare
  u1 uuid := '11111111-1111-4111-8111-111111111111';
  u2 uuid := '22222222-2222-4222-8222-222222222222';
  wid text := 'test_worker_prod';
  bid text := 'test_business_prod';
  tid text := 'test_team_prod';
begin
  perform pg_temp.as_user(u1);

  insert into public.user_roles(user_id, role) values (u1, 'worker');

  if not pg_temp.fails('insert into public.user_roles(user_id,role) values (''11111111-1111-4111-8111-111111111111'',''admin'')')
    then raise exception 'self-assignment of admin role unexpectedly allowed'; end if;
  if not pg_temp.fails('insert into public.user_roles(user_id,role) values (''11111111-1111-4111-8111-111111111111'',''institution'')')
    then raise exception 'self-assignment of institution role unexpectedly allowed'; end if;

  insert into public.profiles(id, display_name, district) values (u1, 'Production Test', 'Gasabo');
  insert into public.worker_profiles(id,user_id,name,title,district,sector,rate_rwf,rate_unit)
    values (wid,u1,'Production Test','Mason','Gasabo','Construction',7000,'day');
  insert into public.worker_skills(worker_id,name) values (wid,'Masonry');
  insert into public.businesses(id,name,sector,district,created_by)
    values (bid,'Production Test Business','Construction','Gasabo',u1);
  insert into public.business_members(business_id,user_id,role) values (bid,u1,'owner');
  insert into public.teams(id,name,sector,lead_user_id,lead_worker_id,areas)
    values (tid,'Production Test Team','Construction',u1,wid,array['Gasabo']);
  insert into public.team_members(team_id,worker_id,role,status)
    values (tid,wid,'lead','active');

  perform pg_temp.as_user(u2);

  if not pg_temp.fails('insert into public.user_roles(user_id,role) values (''11111111-1111-4111-8111-111111111111'',''worker'')')
    then raise exception 'cross-user role insert unexpectedly allowed'; end if;
  if not pg_temp.fails('insert into public.worker_profiles(id,user_id,name,title,district,sector) values (''cross_worker'',''11111111-1111-4111-8111-111111111111'',''x'',''x'',''Gasabo'',''Construction'')')
    then raise exception 'cross-user worker insert unexpectedly allowed'; end if;
  if not pg_temp.fails('insert into public.businesses(id,name,sector,district,created_by) values (''cross_business'',''x'',''Construction'',''Gasabo'',''11111111-1111-4111-8111-111111111111'')')
    then raise exception 'cross-user business insert unexpectedly allowed'; end if;
  if not pg_temp.fails('insert into public.teams(id,name,sector,lead_user_id) values (''cross_team'',''x'',''Construction'',''11111111-1111-4111-8111-111111111111'')')
    then raise exception 'cross-user team insert unexpectedly allowed'; end if;

  perform pg_temp.as_user(u1);

  if not pg_temp.fails('insert into public.applications(opportunity_id,applicant_user_id,kind,note) values (''does-not-exist'',''11111111-1111-4111-8111-111111111111'',''Individual'',''x'')')
    then raise exception 'unknown opportunity application unexpectedly allowed'; end if;

  insert into public.applications(opportunity_id,applicant_user_id,kind,note)
    values ('o1',u1,'Individual','production integrity test');
end $$;

rollback;
