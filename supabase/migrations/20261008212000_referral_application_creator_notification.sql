create or replace function public.respond_referral(_referral_id uuid,_accept boolean)
returns text language plpgsql security definer set search_path=public
as $$
declare r record; opp record; aid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select r.*,w.user_id into r
  from public.referrals r
  join public.worker_profiles w on w.id=r.referee_worker_id
  where r.id=_referral_id for update;
  if not found then raise exception 'Referral not found' using errcode='P0002'; end if;
  if r.user_id<>auth.uid() then raise exception 'Only the referred person can respond' using errcode='42501'; end if;
  if r.status<>'pending' then raise exception 'This referral has already been handled'; end if;
  select * into opp from public.opportunities where id=r.opportunity_id and status='open' and coalesce(is_demo,false)=false;
  if not found then raise exception 'Opportunity is no longer available'; end if;
  if not ('individual'=any(opp.eligible_actor_types)) then raise exception 'This opportunity does not accept individual applicants'; end if;
  if not _accept then
    update public.referrals set status='declined' where id=r.id;
    insert into public.notifications(user_id,kind,text,link) values(r.referrer,'referral_declined','Your referral was declined: '||opp.title,'/opportunities/'||opp.id);
    return 'declined';
  end if;
  insert into public.applications(opportunity_id,applicant_user_id,kind,applicant_type,note,referred_by)
  values(opp.id,auth.uid(),'individual','individual',r.note,r.referrer)
  on conflict (opportunity_id,applicant_user_id) do update
    set referred_by=excluded.referred_by,note=excluded.note,status='submitted',updated_at=now()
  returning id into aid;
  update public.referrals set status='accepted' where id=r.id;
  insert into public.notifications(user_id,kind,text,link) values(r.referrer,'referral_accepted','Your referral accepted and applied: '||opp.title,'/opportunities/'||opp.id);
  if opp.created_by is not null and opp.created_by<>r.referrer then
    insert into public.notifications(user_id,kind,text,link)
    values(opp.created_by,'referral_application','A referred applicant has applied: '||opp.title,'/opportunities/'||opp.id);
  end if;
  if opp.business_id is not null then
    insert into public.notifications(user_id,kind,text,link)
    select bm.user_id,'referral_application','A referred applicant has applied: '||opp.title,'/opportunities/'||opp.id
    from public.business_members bm where bm.business_id=opp.business_id and bm.user_id<>coalesce(opp.created_by,auth.uid());
  end if;
  return aid::text;
end;
$$;

grant execute on function public.respond_referral(uuid,boolean) to authenticated;
