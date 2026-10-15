-- Training completion regression test. The final exception rolls back every fixture.
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
  provider uuid := '00000000-0000-4000-a000-0000000000e1';
  applicant uuid := '00000000-0000-4000-a000-0000000000e2';
  outsider uuid := '00000000-0000-4000-a000-0000000000e3';
  v_training_id uuid := '00000000-0000-4000-a000-0000000000e4';
  v_application_id uuid := '00000000-0000-4000-a000-0000000000e5';
  result text;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (provider, 'authenticated', 'authenticated', 'training-test-provider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (applicant, 'authenticated', 'authenticated', 'training-test-applicant@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (outsider, 'authenticated', 'authenticated', 'training-test-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now())
  on conflict do nothing;

  insert into public.worker_profiles
    (id,user_id,name,title,district,sector,rate_rwf,rate_unit,available,years,bio,initials,verified,rating,reviews,rep,visibility,is_demo)
  values
    ('training-test-worker',applicant,'Training Test Worker','Welder','Gasabo','Construction',10000,'day',true,1,'Test profile','TW',false,0,0,'{}'::jsonb,'public',false);

  insert into public.training_programs
    (id,created_by,title,description,district,provider_type,status,is_demo,skills)
  values
    (v_training_id,provider,'Training Completion Test','Test training description','Gasabo','business','published',false,array['Welding','Safety']);

  insert into public.training_applications
    (id,training_id,applicant_user_id,worker_id,status,note,accepted_at)
  values
    (v_application_id,v_training_id,applicant,'training-test-worker','accepted','Test acceptance',now());

  perform pg_temp.as_user(outsider);
  perform pg_temp.check(
    pg_temp.fails(format('select public.complete_training_application(%L)', v_application_id)),
    'unrelated user cannot complete training'
  );

  perform pg_temp.as_owner();
  perform pg_temp.check(
    (select status='accepted' from public.training_applications where id=v_application_id),
    'unauthorized completion leaves application accepted'
  );
  perform pg_temp.check(
    (select count(*)=0 from public.training_experiences where training_id=v_training_id),
    'unauthorized completion creates no experience'
  );

  perform pg_temp.as_user(provider);
  result := public.complete_training_application(application_id);
  perform pg_temp.check(result='completed','provider completes accepted learner');

  perform pg_temp.as_owner();
  perform pg_temp.check(
    (select status='completed' and completed_at is not null from public.training_applications where id=v_application_id),
    'application completion persisted'
  );
  perform pg_temp.check(
    (select count(*)=1 from public.training_experiences where training_id=v_training_id and worker_id='training-test-worker'),
    'exactly one training experience created'
  );
  perform pg_temp.check(
    (select skills @> array['Welding','Safety'] from public.training_experiences where training_id=v_training_id and worker_id='training-test-worker'),
    'training skills recorded on profile experience'
  );
  perform pg_temp.check(
    (select count(*)=1 from public.notifications where user_id=applicant and kind='training_completed'),
    'learner notified of completion'
  );

  perform pg_temp.as_user(provider);
  perform pg_temp.check(
    pg_temp.fails(format('select public.complete_training_application(%L)', v_application_id)),
    'completed application cannot be completed twice'
  );
  perform pg_temp.as_owner();
  perform pg_temp.check(
    (select count(*)=1 from public.training_experiences where training_id=v_training_id and worker_id='training-test-worker'),
    'repeat completion does not duplicate experience'
  );

  raise exception 'ALL TRAINING COMPLETION TESTS PASSED (rolled back)';
end $$;
