-- Helper privacy regression test. The final exception rolls back all fixtures.
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
  member_user uuid := '00000000-0000-4000-a000-0000000000f1';
  other_user uuid := '00000000-0000-4000-a000-0000000000f2';
  admin_user uuid := '00000000-0000-4000-a000-0000000000f3';
  conversation_id uuid := '00000000-0000-4000-a000-0000000000f4';
begin
  insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (member_user,'authenticated','authenticated','helper-test-member@example.test','{}'::jsonb,'{}'::jsonb,now(),now()),
    (other_user,'authenticated','authenticated','helper-test-other@example.test','{}'::jsonb,'{}'::jsonb,now(),now()),
    (admin_user,'authenticated','authenticated','helper-test-admin@example.test','{}'::jsonb,'{}'::jsonb,now(),now())
  on conflict do nothing;

  insert into public.user_roles(user_id,role)
  values (member_user,'worker'),(other_user,'worker'),(admin_user,'admin');

  insert into public.conversations(id,subject,created_by)
  values (conversation_id,'Private helper test',member_user);
  insert into public.conversation_members(conversation_id,user_id)
  values (conversation_id,member_user),(conversation_id,other_user);

  perform pg_temp.as_user(member_user);
  perform pg_temp.check(public.has_role('worker',member_user),'users can check own role');
  perform pg_temp.check(not public.has_role('admin',admin_user),'users cannot probe another user role');
  perform pg_temp.check(public.is_conversation_member(conversation_id,member_user),'users can check own conversation membership');
  perform pg_temp.check(not public.is_conversation_member(conversation_id,other_user),'users cannot probe another member');

  perform pg_temp.as_user(admin_user);
  perform pg_temp.check(public.has_role('admin',admin_user),'admin can check own role');
  perform pg_temp.check(public.has_role('worker',other_user),'admin can check another user role');
  perform pg_temp.check(public.is_conversation_member(conversation_id,other_user),'admin can inspect conversation membership');

  raise exception 'ALL SECURITY HELPER TESTS PASSED (rolled back)';
end $$;
