create or replace function public.shortlist_training_application(_application_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_application_id uuid;
  v_applicant_user_id uuid;
  v_application_status text;
  v_training_title text;
  v_provider_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select ta.id, ta.applicant_user_id, ta.status, tp.title, tp.created_by
    into v_application_id, v_applicant_user_id, v_application_status, v_training_title, v_provider_id
  from public.training_applications as ta
  join public.training_programs as tp on tp.id = ta.training_id
  where ta.id = _application_id
  for update of ta;

  if not found then
    raise exception 'Training application not found' using errcode = 'P0002';
  end if;
  if v_provider_id <> auth.uid() then
    raise exception 'Only the training provider can shortlist applicants' using errcode = '42501';
  end if;
  if v_application_status <> 'applied' then
    raise exception 'Only applied candidates can be shortlisted';
  end if;

  update public.training_applications
  set status = 'shortlisted', shortlisted_at = now(), updated_at = now()
  where id = v_application_id;

  insert into public.notifications(user_id, kind, text, link)
  values (v_applicant_user_id, 'training_shortlisted',
    'You were shortlisted for: ' || v_training_title, '/training');

  return 'shortlisted';
end;
$function$;