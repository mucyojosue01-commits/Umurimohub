-- Opportunity RLS regression test. The final exception rolls back all fixtures.
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

create or replace function pg_temp.check(_ok boolean, _name text) returns void language plpgsql as $$
begin
  if not coalesce(_ok, false) then raise exception 'FAILED: %', _name; end if;
end $$;

do $$
declare
  owner_user uuid := '00000000-0000-4000-a000-0000000000f9';
  outsider uuid := '00000000-0000-4000-a000-0000000000fa';
begin
  insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (owner_user,'authenticated','authenticated','opportunity-rls-owner@example.test','{}'::jsonb,'{}'::jsonb,now(),now()),
    (outsider,'authenticated','authenticated','opportunity-rls-outsider@example.test','{}'::jsonb,'{}'::jsonb,now(),now())
  on conflict do nothing;

  insert into public.businesses(id,name,sector,district,verified,rating,about,services,is_demo,created_by)
  values ('opportunity-rls-biz','Opportunity RLS Test','Construction','Gasabo',false,0,'test','{}',false,owner_user);
  insert into public.business_members(business_id,user_id,role)
  values ('opportunity-rls-biz',owner_user,'owner');

  insert into public.opportunities
    (id,business_id,created_by,title,sector,district,type,pay_rwf,pay_unit,mode,duration,deadline,team_allowed,team_size,skills,summary,responsibilities,requirements,featured,status,is_demo)
  values
    ('opportunity-rls-demo','opportunity-rls-biz',owner_user,'Read Only Demo','Construction','Gasabo','Project',10000,'project','On-site','1 month',current_date+30,false,1,'{}','test','{}','{}',false,'open',true),
    ('opportunity-rls-normal','opportunity-rls-biz',owner_user,'Normal Opportunity','Construction','Gasabo','Project',10000,'project','On-site','1 month',current_date+30,false,1,'{}','test','{}','{}',false,'open',false);

  perform pg_temp.as_user(owner_user);
  update public.opportunities set status='closed' where id='opportunity-rls-demo';
  perform pg_temp.check(
    (select status='open' and is_demo from public.opportunities where id='opportunity-rls-demo'),
    'creator cannot update demo opportunity'
  );
  delete from public.opportunities where id='opportunity-rls-demo';
  perform pg_temp.check(
    (select count(*)=1 from public.opportunities where id='opportunity-rls-demo'),
    'creator cannot delete demo opportunity'
  );
  update public.opportunities set status='closed' where id='opportunity-rls-normal';
  perform pg_temp.check(
    (select status='closed' from public.opportunities where id='opportunity-rls-normal'),
    'creator can still update normal opportunity'
  );

  perform pg_temp.as_owner();
  update public.opportunities set status='open' where id='opportunity-rls-normal';
  perform pg_temp.as_user(outsider);
  update public.opportunities set status='closed' where id='opportunity-rls-normal';
  perform pg_temp.check(
    (select status='open' from public.opportunities where id='opportunity-rls-normal'),
    'unrelated user cannot update another business opportunity'
  );

  raise exception 'ALL OPPORTUNITY RLS TESTS PASSED (rolled back)';
end $$;
