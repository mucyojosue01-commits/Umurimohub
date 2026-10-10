-- Qualify rating workflow variables to avoid PL/pgSQL column ambiguity and define the actor UID.
create or replace function public.rate_completed_contract(_contract_id uuid,_score integer,_review text default '')
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.contracts%rowtype;
  v_subject_type text;
  v_subject_id text;
  v_rater_uid uuid := auth.uid();
  v_rating_id uuid;
begin
  if v_rater_uid is null then
    raise exception 'Not authenticated' using errcode='42501';
  end if;
  if _score not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select * into c
  from public.contracts as ct
  where ct.id = _contract_id;

  if not found or c.status <> 'completed' then
    raise exception 'Only completed contracts can be rated';
  end if;

  if public.is_business_member(c.business_id) and c.worker_id is not null then
    v_subject_type := 'worker'; v_subject_id := c.worker_id;
  elsif public.is_business_member(c.business_id) and c.team_id is not null then
    v_subject_type := 'team'; v_subject_id := c.team_id;
  elsif c.worker_id is not null and c.worker_id = public.my_worker_id() then
    v_subject_type := 'business'; v_subject_id := c.business_id;
  elsif c.team_id is not null and public.is_team_lead(c.team_id, v_rater_uid) then
    v_subject_type := 'business'; v_subject_id := c.business_id;
  else
    raise exception 'Only contracting parties can rate this contract' using errcode='42501';
  end if;

  insert into public.contract_ratings as existing_rating
    (contract_id,rater_user_id,subject_type,subject_id,score,review)
  values
    (c.id,v_rater_uid,v_subject_type,v_subject_id,_score,left(btrim(coalesce(_review,'')),2000))
  on conflict (contract_id,rater_user_id,subject_type,subject_id)
  do update set score=excluded.score,review=excluded.review,updated_at=now()
  returning existing_rating.id into v_rating_id;

  perform public.recalculate_actor_trust(v_subject_type,v_subject_id);
  perform public.recalculate_actor_trust('business',c.business_id);

  insert into public.notifications(user_id,kind,text,link)
  select wp.user_id,'rating_received','You received a rating for: '||c.title,'/workers/'||wp.id
  from public.worker_profiles as wp
  where v_subject_type='worker' and wp.id=v_subject_id and wp.user_id is not null;

  return v_rating_id;
end;
$$;

grant execute on function public.rate_completed_contract(uuid,integer,text) to authenticated;
