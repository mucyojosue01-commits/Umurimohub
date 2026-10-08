create or replace function public.create_referral(
  _opportunity_id text,
  _referee_worker_id text,
  _note text default ''
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  actor uuid := auth.uid();
  opp record;
  worker record;
  referral_id uuid;
  business_id text;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode='42501';
  end if;
  select o.* into opp from public.opportunities o
  where o.id=_opportunity_id and o.status='open' and coalesce(o.is_demo,false)=false;
  if not found then raise exception 'Opportunity is not available'; end if;
  select w.id,w.user_id,w.visibility into worker from public.worker_profiles w
  where w.id=_referee_worker_id and coalesce(w.is_demo,false)=false and w.visibility='public';
  if not found or worker.user_id is null then raise exception 'That person is not available for referral'; end if;
  if worker.user_id=actor then raise exception 'You cannot refer yourself'; end if;
  if exists(select 1 from public.referrals r where r.opportunity_id=_opportunity_id and r.referee_worker_id=_referee_worker_id and r.referrer=actor)
    then raise exception 'You already referred this person for this opportunity' using errcode='23505'; end if;
  insert into public.referrals(opportunity_id,referee_worker_id,referrer,note)
  values(_opportunity_id,_referee_worker_id,actor,left(coalesce(_note,''),500))
  returning id into referral_id;
  insert into public.notifications(user_id,kind,text,link)
  values(worker.user_id,'referral_received','You were referred for: '||opp.title,'/network');
  business_id:=opp.business_id;
  if business_id is not null and public.is_business_member(business_id) then
    insert into public.notifications(user_id,kind,text,link)
    select bm.user_id,'referral_received','A trusted person referred someone for: '||opp.title,'/opportunities/'||opp.id
    from public.business_members bm where bm.business_id=business_id and bm.user_id<>actor;
  end if;
  return referral_id;
end;
$$;

grant execute on function public.create_referral(text,text,text) to authenticated;