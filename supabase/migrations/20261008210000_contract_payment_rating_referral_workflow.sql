-- Contract re-acceptance, referral approval/application, project payments and ratings/trust.

create table if not exists public.contract_payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  payer_business_id text not null references public.businesses(id) on delete restrict,
  recipient_worker_id text references public.worker_profiles(id) on delete restrict,
  recipient_team_id text references public.teams(id) on delete restrict,
  amount_rwf bigint not null check (amount_rwf > 0),
  status text not null default 'pending' check (status in ('pending','paid','confirmed','disputed','cancelled')),
  payment_reference text,
  note text not null default '',
  paid_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((recipient_worker_id is not null) <> (recipient_team_id is not null))
);

create unique index if not exists contract_payments_contract_unique on public.contract_payments(contract_id);
create index if not exists contract_payments_recipient_worker_idx on public.contract_payments(recipient_worker_id);
create index if not exists contract_payments_recipient_team_idx on public.contract_payments(recipient_team_id);
alter table public.contract_payments enable row level security;

drop policy if exists "contract payment parties read" on public.contract_payments;
create policy "contract payment parties read" on public.contract_payments
for select to authenticated using (
  public.is_business_member(payer_business_id)
  or (recipient_worker_id is not null and recipient_worker_id = public.my_worker_id())
  or (recipient_team_id is not null and public.is_team_lead(recipient_team_id))
);

create table if not exists public.contract_ratings (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  rater_user_id uuid not null references auth.users(id) on delete restrict,
  subject_type text not null check (subject_type in ('worker','team','business')),
  subject_id text not null,
  score integer not null check (score between 1 and 5),
  review text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contract_id,rater_user_id,subject_type,subject_id)
);
create index if not exists contract_ratings_subject_idx on public.contract_ratings(subject_type,subject_id,created_at desc);
alter table public.contract_ratings enable row level security;

drop policy if exists "contract ratings parties read" on public.contract_ratings;
create policy "contract ratings parties read" on public.contract_ratings
for select to authenticated using (
  rater_user_id = auth.uid()
  or public.is_contract_party(contract_id)
);

alter table public.worker_profiles add column if not exists trust_score numeric(5,2) not null default 0 check (trust_score between 0 and 100);
alter table public.teams add column if not exists trust_score numeric(5,2) not null default 0 check (trust_score between 0 and 100);
alter table public.businesses add column if not exists trust_score numeric(5,2) not null default 0 check (trust_score between 0 and 100);

create or replace function public.recalculate_actor_trust(_subject_type text,_subject_id text)
returns numeric language plpgsql security definer set search_path=public
as $$
declare completed_count int; paid_count int; rating_avg numeric; rating_count int; repeat_count int; score numeric;
begin
  select count(*)::int into completed_count from public.verified_experiences
   where (_subject_type='worker' and worker_id=_subject_id)
      or (_subject_type='team' and team_id=_subject_id)
      or (_subject_type='business' and business_id=_subject_id);
  select count(*)::int into paid_count from public.contract_payments p
   join public.contracts c on c.id=p.contract_id
   where p.status in ('paid','confirmed')
     and ((_subject_type='worker' and c.worker_id=_subject_id)
       or (_subject_type='team' and c.team_id=_subject_id)
       or (_subject_type='business' and c.business_id=_subject_id));
  select coalesce(avg(score),0),count(*)::int into rating_avg,rating_count
   from public.contract_ratings where subject_type=_subject_type and subject_id=_subject_id;
  select count(*)::int into repeat_count
   from public.reputation_evidence
   where subject_type=_subject_type and subject_id=_subject_id and evidence_type='repeat_employer_relationship';
  score := least(100, greatest(0,
    least(40, completed_count * 8)
    + least(25, paid_count * 5)
    + rating_avg * 6
    + least(10, repeat_count * 5)
  ));
  if _subject_type='worker' then
    update public.worker_profiles
      set trust_score=score,rating=case when rating_count>0 then rating_avg else rating end,reviews=rating_count,
          rep=jsonb_build_object(
            'completion',case when completed_count>0 then least(100,completed_count*20) else 0 end,
            'onTime',case when completed_count>0 then least(100,completed_count*20) else 0 end,
            'response',coalesce((rep->>'response')::numeric,0),
            'repeat',repeat_count,'verifiedProjects',completed_count,'recommendations',coalesce((rep->>'recommendations')::int,0)
          )
      where id=_subject_id;
  elsif _subject_type='team' then
    update public.teams set trust_score=score,rating=case when rating_count>0 then rating_avg else rating end where id=_subject_id;
  elsif _subject_type='business' then
    update public.businesses set trust_score=score,rating=case when rating_count>0 then rating_avg else rating end where id=_subject_id;
  end if;
  return score;
end;
$$;

create or replace function public.reaccept_cancelled_contract(_contract_id uuid)
returns public.contract_status language plpgsql security definer set search_path=public
as $$
declare c record; uid uuid:=auth.uid(); cp uuid;
begin
  if uid is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into c from public.contracts where id=_contract_id for update;
  if not found then raise exception 'Contract not found' using errcode='P0002'; end if;
  if c.status <> 'cancelled' then raise exception 'Only cancelled contracts can be re-accepted'; end if;
  if not (
    public.is_business_member(c.business_id)
    or (c.worker_id is not null and c.worker_id=public.my_worker_id())
    or (c.team_id is not null and public.is_team_lead(c.team_id))
  ) then raise exception 'Only a contracting party can re-accept this contract' using errcode='42501'; end if;
  update public.contracts set status='active',cancelled_at=null,accepted_at=coalesce(accepted_at,now()),activated_at=coalesce(activated_at,now()),updated_at=now() where id=c.id;
  insert into public.contract_events(contract_id,actor,event_type,from_status,to_status,note)
  values(c.id,uid,'reaccepted','cancelled','active','Cancelled contract re-accepted');
  cp:=public.contract_counterparty_user(c.id);
  if cp is not null and cp<>uid then
    insert into public.notifications(user_id,kind,text,link) values(cp,'contract_reaccepted','Contract re-accepted: '||c.title,'/contracts/'||c.id);
  end if;
  return 'active';
end;
$$;

create or replace function public.respond_referral(_referral_id uuid,_accept boolean)
returns text language plpgsql security definer set search_path=public
as $$
declare r record; w record; opp record; aid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select r.*,w.user_id into r from public.referrals r join public.worker_profiles w on w.id=r.referee_worker_id where r.id=_referral_id for update;
  if not found then raise exception 'Referral not found' using errcode='P0002'; end if;
  if r.user_id<>auth.uid() then raise exception 'Only the referred person can respond' using errcode='42501'; end if;
  if r.status<>'pending' then raise exception 'This referral has already been handled'; end if;
  select * into opp from public.opportunities where id=r.opportunity_id and status='open';
  if not found then raise exception 'Opportunity is no longer available'; end if;
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
  if opp.business_id is not null then
    insert into public.notifications(user_id,kind,text,link)
    select bm.user_id,'referral_application','A referred applicant has applied: '||opp.title,'/opportunities/'||opp.id
    from public.business_members bm where bm.business_id=opp.business_id;
  end if;
  return aid::text;
end;
$$;

create or replace function public.create_contract_payment(_contract_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare c record; pid uuid;
begin
  select * into c from public.contracts where id=_contract_id;
  if not found then raise exception 'Contract not found'; end if;
  if not public.is_business_member(c.business_id,array['owner','admin']) then raise exception 'Only the hiring business can create a payment' using errcode='42501'; end if;
  if c.status<>'completed' then raise exception 'Payment can only be created after contract completion'; end if;
  if exists(select 1 from public.contract_payments where contract_id=c.id) then
    select id into pid from public.contract_payments where contract_id=c.id;
    return pid;
  end if;
  insert into public.contract_payments(contract_id,payer_business_id,recipient_worker_id,recipient_team_id,amount_rwf)
  values(c.id,c.business_id,c.worker_id,c.team_id,c.amount_rwf)
  returning id into pid;
  return pid;
end;
$$;

create or replace function public.mark_contract_payment_paid(_payment_id uuid,_reference text default null)
returns text language plpgsql security definer set search_path=public
as $$
declare p record; c record;
begin
  select * into p from public.contract_payments where id=_payment_id for update;
  if not found then raise exception 'Payment not found' using errcode='P0002'; end if;
  if not public.is_business_member(p.payer_business_id,array['owner','admin']) then raise exception 'Only the payer business can mark a payment paid' using errcode='42501'; end if;
  update public.contract_payments set status='paid',payment_reference=nullif(btrim(coalesce(_reference,'')),''),paid_at=now(),updated_at=now() where id=p.id;
  select * into c from public.contracts where id=p.contract_id;
  insert into public.notifications(user_id,kind,text,link)
  select wp.user_id,'payment_paid','Payment recorded for: '||c.title,'/contracts/'||c.id from public.worker_profiles wp where p.recipient_worker_id=wp.id and wp.user_id is not null;
  insert into public.notifications(user_id,kind,text,link)
  select t.lead_user_id,'payment_paid','Team payment recorded for: '||c.title,'/contracts/'||c.id from public.teams t where p.recipient_team_id=t.id and t.lead_user_id is not null;
  return 'paid';
end;
$$;

create or replace function public.confirm_contract_payment_received(_payment_id uuid)
returns text language plpgsql security definer set search_path=public
as $$
declare p record; c record;
begin
  select * into p from public.contract_payments where id=_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if not ((p.recipient_worker_id is not null and p.recipient_worker_id=public.my_worker_id()) or (p.recipient_team_id is not null and public.is_team_lead(p.recipient_team_id))) then raise exception 'Only the recipient can confirm payment' using errcode='42501'; end if;
  if p.status<>'paid' then raise exception 'Payment must be marked paid first'; end if;
  update public.contract_payments set status='confirmed',confirmed_at=now(),updated_at=now() where id=p.id;
  select * into c from public.contracts where id=p.contract_id;
  perform public.recalculate_actor_trust(case when p.recipient_worker_id is not null then 'worker' else 'team' end,coalesce(p.recipient_worker_id,p.recipient_team_id));
  return 'confirmed';
end;
$$;

create or replace function public.rate_completed_contract(_contract_id uuid,_score integer,_review text default '')
returns uuid language plpgsql security definer set search_path=public
as $$
declare c record; subject_type text; subject_id text; rid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  if _score not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
  select * into c from public.contracts where id=_contract_id;
  if not found or c.status<>'completed' then raise exception 'Only completed contracts can be rated'; end if;
  if public.is_business_member(c.business_id) and c.worker_id is not null then subject_type:='worker'; subject_id:=c.worker_id;
  elsif public.is_business_member(c.business_id) and c.team_id is not null then subject_type:='team'; subject_id:=c.team_id;
  elsif c.worker_id is not null and c.worker_id=public.my_worker_id() then subject_type:='business'; subject_id:=c.business_id;
  elsif c.team_id is not null and public.is_team_lead(c.team_id) then subject_type:='business'; subject_id:=c.business_id;
  else raise exception 'Only contracting parties can rate this contract' using errcode='42501'; end if;
  insert into public.contract_ratings(contract_id,rater_user_id,subject_type,subject_id,score,review)
  values(c.id,auth.uid(),subject_type,subject_id,_score,left(btrim(coalesce(_review,'')),2000))
  on conflict(contract_id,rater_user_id,subject_type,subject_id) do update set score=excluded.score,review=excluded.review,updated_at=now()
  returning id into rid;
  perform public.recalculate_actor_trust(subject_type,subject_id);
  perform public.recalculate_actor_trust('business',c.business_id);
  insert into public.notifications(user_id,kind,text,link)
  select wp.user_id,'rating_received','You received a rating for: '||c.title,'/workers/'||wp.id from public.worker_profiles wp where subject_type='worker' and wp.id=subject_id and wp.user_id is not null;
  return rid;
end;
$$;

grant execute on function public.reaccept_cancelled_contract(uuid) to authenticated;
grant execute on function public.respond_referral(uuid,boolean) to authenticated;
grant execute on function public.create_contract_payment(uuid) to authenticated;
grant execute on function public.mark_contract_payment_paid(uuid,text) to authenticated;
grant execute on function public.confirm_contract_payment_received(uuid) to authenticated;
grant execute on function public.rate_completed_contract(uuid,integer,text) to authenticated;
