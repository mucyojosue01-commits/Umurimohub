-- Public profile visibility, validated referrals, and contract proposal actions.
drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read"
on public.profiles for select
to anon, authenticated
using (true);

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
  values(worker.user_id,'referral_received','You were referred for: '||opp.title,'/opportunities/'||opp.id);
  business_id:=opp.business_id;
  if business_id is not null and public.is_business_member(business_id) then
    insert into public.notifications(user_id,kind,text,link)
    select bm.user_id,'referral_received','A trusted person referred someone for: '||opp.title,'/opportunities/'||opp.id
    from public.business_members bm where bm.business_id=business_id and bm.user_id<>actor;
  end if;
  return referral_id;
end;
$$;

create or replace function public.update_contract(
  _contract_id uuid,_title text,_scope text,_amount_rwf bigint,
  _start_date date default null,_end_date date default null,_terms text default null
)
returns public.contract_status
language plpgsql
security definer
set search_path to 'public'
as $$
declare c record; cp uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into c from public.contracts where id=_contract_id for update;
  if not found then raise exception 'Contract not found' using errcode='P0002'; end if;
  if not public.is_business_member(c.business_id,array['owner','admin']) then raise exception 'Only the hiring business owner or admin can edit a contract' using errcode='42501'; end if;
  if c.status<>'proposed' then raise exception 'Only proposed contracts can be edited. Cancel and create a new proposal for active work.'; end if;
  if char_length(btrim(coalesce(_title,''))) not between 3 and 200 then raise exception 'Title must be 3–200 characters'; end if;
  if char_length(btrim(coalesce(_scope,'')))<10 then raise exception 'Scope must be at least 10 characters'; end if;
  if _amount_rwf<=0 then raise exception 'Amount must be above 0'; end if;
  if _start_date is not null and _end_date is not null and _end_date<_start_date then raise exception 'End date must be after start date'; end if;
  update public.contracts set title=btrim(_title),scope=btrim(_scope),amount_rwf=_amount_rwf,start_date=_start_date,end_date=_end_date,terms=nullif(btrim(coalesce(_terms,'')),''),updated_at=now() where id=c.id;
  insert into public.contract_events(contract_id,actor,event_type,from_status,to_status,note) values(c.id,auth.uid(),'edited','proposed','proposed','Contract proposal updated');
  cp:=public.contract_counterparty_user(c.id);
  if cp is not null then insert into public.notifications(user_id,kind,text,link) values(cp,'contract_updated','Contract proposal updated: '||btrim(_title),'/dashboard'); end if;
  return 'proposed';
end;
$$;

create or replace function public.delete_contract(_contract_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare c record; cp uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into c from public.contracts where id=_contract_id for update;
  if not found then raise exception 'Contract not found' using errcode='P0002'; end if;
  if not public.is_business_member(c.business_id,array['owner','admin']) then raise exception 'Only the hiring business owner or admin can delete a contract proposal' using errcode='42501'; end if;
  if c.status<>'proposed' then raise exception 'Only proposed contracts can be deleted'; end if;
  if exists(select 1 from public.milestones where contract_id=c.id) then raise exception 'This contract already has milestones; cancel it instead'; end if;
  cp:=public.contract_counterparty_user(c.id);
  if cp is not null then insert into public.notifications(user_id,kind,text,link) values(cp,'contract_deleted','Contract proposal deleted: '||c.title,'/dashboard'); end if;
  delete from public.contract_events where contract_id=c.id;
  delete from public.contract_completions where contract_id=c.id;
  delete from public.contracts where id=c.id;
end;
$$;