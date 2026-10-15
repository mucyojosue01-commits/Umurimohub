-- Skills promised by a training program are recorded on the learner's completed experience.
alter table public.training_programs
  add column if not exists skills text[] not null default '{}';

alter table public.training_experiences
  add column if not exists skills text[] not null default '{}';

-- Only the training provider can confirm completion. Persist the provider's declared skills
-- into the worker's public training history as part of the same transaction.
create or replace function public.complete_training_application(_application_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_application_id uuid;
  v_applicant_user_id uuid;
  v_worker_id text;
  v_training_id uuid;
  v_status text;
  v_title text;
  v_description text;
  v_skills text[];
  v_provider_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select ta.id, ta.applicant_user_id, ta.worker_id, ta.training_id, ta.status,
         tp.title, tp.description, tp.skills, tp.created_by
    into v_application_id, v_applicant_user_id, v_worker_id, v_training_id, v_status,
         v_title, v_description, v_skills, v_provider_id
  from public.training_applications ta
  join public.training_programs tp on tp.id = ta.training_id
  where ta.id = _application_id
  for update of ta;

  if not found then
    raise exception 'Training application not found' using errcode = 'P0002';
  end if;
  if v_provider_id <> auth.uid() then
    raise exception 'Only the training provider can mark completion' using errcode = '42501';
  end if;
  if v_status <> 'accepted' then
    raise exception 'Only accepted training applications can be completed';
  end if;

  update public.training_applications
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = v_application_id;

  insert into public.training_experiences
    (training_id, worker_id, provider_user_id, title, description, skills, completed_at)
  values
    (v_training_id, v_worker_id, v_provider_id, v_title, v_description, coalesce(v_skills, '{}'), now())
  on conflict (training_id, worker_id) do update
    set provider_user_id = excluded.provider_user_id,
        title = excluded.title,
        description = excluded.description,
        skills = excluded.skills,
        completed_at = excluded.completed_at;

  insert into public.notifications(user_id, kind, text, link)
  values (v_applicant_user_id, 'training_completed', 'Training completed: ' || v_title, '/workers/' || v_worker_id);

  return 'completed';
end;
$function$;

revoke all on function public.complete_training_application(uuid) from public;
revoke all on function public.complete_training_application(uuid) from anon;
grant execute on function public.complete_training_application(uuid) to authenticated;
