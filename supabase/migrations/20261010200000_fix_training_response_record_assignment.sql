create or replace function public.respond_training_application(_application_id uuid, _accept boolean, _note text default null)
returns text language plpgsql security definer set search_path = public as $function$
declare
  v_application_id uuid;
  v_applicant_user_id uuid;
  v_status text;
  v_title text;
  v_provider_id uuid;
  v_existing_note text;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select ta.id, ta.applicant_user_id, ta.status, tp.title, tp.created_by, ta.note
    into v_application_id, v_applicant_user_id, v_status, v_title, v_provider_id, v_existing_note
  from public.training_applications ta join public.training_programs tp on tp.id = ta.training_id
  where ta.id = _application_id for update of ta;
  if not found then raise exception 'Training application not found' using errcode = 'P0002'; end if;
  if v_applicant_user_id <> auth.uid() then raise exception 'Only the applicant can respond' using errcode = '42501'; end if;
  if v_status <> 'shortlisted' then raise exception 'This training application is not awaiting your response'; end if;
  if _accept then
    update public.training_applications set status='accepted', accepted_at=now(),
      note=case when nullif(btrim(coalesce(_note,'')),'') is null then v_existing_note else left(btrim(_note),2000) end,
      updated_at=now() where id=v_application_id;
    insert into public.notifications(user_id,kind,text,link) values(v_provider_id,'training_accepted','Training candidate accepted: '||v_title,'/training');
    return 'accepted';
  end if;
  update public.training_applications set status='declined',
    note=case when nullif(btrim(coalesce(_note,'')),'') is null then v_existing_note else left(btrim(_note),2000) end,
    updated_at=now() where id=v_application_id;
  insert into public.notifications(user_id,kind,text,link) values(v_provider_id,'training_declined','Training candidate declined: '||v_title,'/training');
  return 'declined';
end;
$function$;

create or replace function public.complete_training_application(_application_id uuid)
returns text language plpgsql security definer set search_path = public as $function$
declare
  v_application_id uuid;
  v_applicant_user_id uuid;
  v_training_id uuid;
  v_status text;
  v_title text;
  v_description text;
  v_provider_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select ta.id, ta.applicant_user_id, ta.training_id, ta.status, tp.title, tp.description, tp.created_by
    into v_application_id, v_applicant_user_id, v_training_id, v_status, v_title, v_description, v_provider_id
  from public.training_applications ta join public.training_programs tp on tp.id=ta.training_id
  where ta.id=_application_id for update of ta;
  if not found then raise exception 'Training application not found' using errcode = 'P0002'; end if;
  if v_provider_id <> auth.uid() then raise exception 'Only the training provider can mark completion' using errcode = '42501'; end if;
  if v_status <> 'accepted' then raise exception 'Only accepted training applications can be completed'; end if;
  update public.training_applications set status='completed', completed_at=now(), updated_at=now() where id=v_application_id;
  return 'completed';
end;
$function$;
