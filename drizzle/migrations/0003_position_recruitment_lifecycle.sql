-- Position recruitment lifecycle: company-owned positions, individual-only applications,
-- audited status transitions, offer -> acceptance -> employment, position referrals,
-- employment end, scalable business directory search. Idempotent and self-contained.

alter type public.application_status add value if not exists 'under_review';
alter type public.application_status add value if not exists 'interview';
alter type public.application_status add value if not exists 'offer';

alter table public.opportunities add column if not exists position_name text;
comment on column public.opportunities.duration is 'Not used for positions (type=Job); retained for legacy rows and other opportunity types.';

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create table if not exists public.employment_offers (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id) on delete cascade,
  worker_id text not null references public.worker_profiles(id) on delete cascade,
  worker_user_id uuid not null,
  position_name text not null check (length(trim(position_name)) between 2 and 120),
  employment_type text not null default 'full_time' check (employment_type in ('full_time','part_time','contract','temporary','apprenticeship')),
  details text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn','ended')),
  offered_by uuid not null default auth.uid(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.company_employments (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.businesses(id) on delete cascade,
  worker_id text not null references public.worker_profiles(id) on delete cascade,
  worker_user_id uuid not null,
  position_name text not null,
  employment_type text not null default 'full_time',
  started_at date not null default current_date,
  ended_at date,
  status text not null default 'active' check (status in ('active','ended')),
  offer_id uuid unique references public.employment_offers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.employment_offers add column if not exists application_id uuid references public.applications(id) on delete set null;
alter table public.company_employments add column if not exists application_id uuid references public.applications(id) on delete set null;
alter table public.company_employments add column if not exists ended_by uuid;
create unique index if not exists employment_offers_application_uidx on public.employment_offers(application_id) where application_id is not null;
create index if not exists employment_offers_worker_idx on public.employment_offers(worker_user_id, status, created_at desc);
create index if not exists company_employments_business_idx on public.company_employments(business_id, status, created_at desc);
create index if not exists company_employments_worker_idx on public.company_employments(worker_id, status, created_at desc);
do $$ begin
  if not exists (select 1 from public.company_employments where status = 'active' group by business_id, worker_id having count(*) > 1) then
    create unique index if not exists company_employments_one_active_uidx on public.company_employments(business_id, worker_id) where status = 'active';
  end if;
end $$;

grant select, insert on public.employment_offers to authenticated;
grant select on public.company_employments to authenticated;
grant all on public.employment_offers to service_role;
grant all on public.company_employments to service_role;
alter table public.employment_offers enable row level security;
alter table public.company_employments enable row level security;
drop policy if exists "employment offers parties read" on public.employment_offers;
create policy "employment offers parties read" on public.employment_offers for select to authenticated
using (worker_user_id = auth.uid() or public.is_business_member(business_id) or public.is_platform_admin());
drop policy if exists "business members create employment offers" on public.employment_offers;
create policy "business members create employment offers" on public.employment_offers for insert to authenticated
with check (public.is_business_member(business_id) and offered_by = auth.uid());
drop policy if exists "company employments public active read" on public.company_employments;
create policy "company employments public active read" on public.company_employments for select to authenticated
using (status = 'active' or worker_user_id = auth.uid() or public.is_business_member(business_id) or public.is_platform_admin());

create or replace function public.notify_employment_offer_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare company_name text;
begin
  select name into company_name from public.businesses where id = new.business_id;
  insert into public.notifications(user_id, kind, text, link)
  values (new.worker_user_id, 'employment_offer', coalesce(company_name,'A company') || ' offered you the ' || new.position_name || ' position.', '/workers/' || new.worker_id);
  return new;
end $$;
drop trigger if exists employment_offer_notify_worker on public.employment_offers;
create trigger employment_offer_notify_worker after insert on public.employment_offers
for each row execute function public.notify_employment_offer_created();

create table if not exists public.application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  actor uuid,
  from_status text,
  to_status text not null,
  note text,
  at timestamptz not null default now()
);
create index if not exists application_events_app_idx on public.application_events(application_id, at);
grant select on public.application_events to authenticated;
grant all on public.application_events to service_role;
alter table public.application_events enable row level security;
drop policy if exists "application events parties read" on public.application_events;
create policy "application events parties read" on public.application_events for select to authenticated
using (exists (
  select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
  where a.id = application_id and (a.applicant_user_id = auth.uid() or public.is_business_member(o.business_id))
));
create or replace function public.block_application_event_change()
returns trigger language plpgsql as $$ begin raise exception 'Application history is immutable'; end $$;
drop trigger if exists application_events_immutable on public.application_events;
create trigger application_events_immutable before update or delete on public.application_events
for each row execute function public.block_application_event_change();

create or replace function public.enforce_position_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type <> 'Job' or coalesce(new.is_demo, false) then return new; end if;
  if tg_op = 'INSERT' and new.business_id is null then
    raise exception 'A position must belong to a company' using errcode = '23514'; end if;
  if auth.uid() is not null and new.business_id is not null
     and not public.is_business_member(new.business_id, array['owner','manager','recruiter'])
     and not public.is_platform_admin() then
    raise exception 'Only authorized company members can manage this position' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.business_id is distinct from old.business_id and old.business_id is not null and not public.is_platform_admin() then
    raise exception 'A position cannot move to another company' using errcode = '42501'; end if;
  new.team_allowed := false;
  new.team_size := null;
  return new;
end $$;
drop trigger if exists positions_company_owner on public.opportunities;
create trigger positions_company_owner before insert or update on public.opportunities
for each row execute function public.enforce_position_ownership();

create or replace function public.enforce_position_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select type, business_id, status, deadline into o from public.opportunities where id = new.opportunity_id;
  if o.type is distinct from 'Job' then return new; end if;
  if tg_op = 'INSERT' then
    if new.team_id is not null or lower(new.kind) <> 'individual' then
      raise exception 'Positions accept individual applications only' using errcode = '23514'; end if;
    if o.business_id is null or o.status <> 'open' or o.deadline < current_date then
      raise exception 'This position is no longer accepting applications'; end if;
    if public.is_business_member(o.business_id) then
      raise exception 'Company members cannot apply to their own position' using errcode = '42501'; end if;
    new.status := 'submitted';
    return new;
  end if;
  if new.status is distinct from old.status
     and coalesce(current_setting('umurimo.position_transition', true), '') <> 'on'
     and not (new.status::text = 'withdrawn' and auth.uid() = old.applicant_user_id
              and old.status::text not in ('accepted','rejected','withdrawn')) then
    raise exception 'Use the applicant workflow to change position application status' using errcode = '42501';
  end if;
  if new.team_id is distinct from old.team_id or new.kind is distinct from old.kind then
    raise exception 'Positions accept individual applications only'; end if;
  return new;
end $$;
drop trigger if exists position_application_rules on public.applications;
create trigger position_application_rules before insert or update on public.applications
for each row execute function public.enforce_position_application();

create or replace function public.position_transition_allowed(_from text, _to text)
returns boolean language sql immutable as $$
  select case
    when _from in ('submitted','viewed') then _to in ('under_review','shortlisted','rejected')
    when _from = 'under_review' then _to in ('shortlisted','interview','rejected')
    when _from = 'shortlisted' then _to in ('interview','offer','rejected')
    when _from = 'interview' then _to in ('offer','rejected')
    when _from = 'offer' then _to in ('rejected')
    else false end
$$;

create or replace function public.set_position_application_status(
  _application_id uuid, _status text, _note text default null,
  _employment_type text default 'full_time', _offer_details text default '')
returns text language plpgsql security definer set search_path = public as $$
declare a record; o record; wid text; prev text;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into a from public.applications where id = _application_id for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  select * into o from public.opportunities where id = a.opportunity_id;
  if o.type <> 'Job' then raise exception 'Not a position application'; end if;
  if not public.is_business_member(o.business_id, array['owner','manager','recruiter']) and not public.is_platform_admin() then
    raise exception 'Only authorized company members can manage applicants' using errcode = '42501'; end if;
  prev := a.status::text;
  if not public.position_transition_allowed(prev, _status) then
    raise exception 'Invalid status change % -> %', prev, _status; end if;
  if _status = 'offer' then
    select id into wid from public.worker_profiles where user_id = a.applicant_user_id limit 1;
    if wid is null then raise exception 'The applicant needs a worker profile before receiving an offer'; end if;
    insert into public.employment_offers(business_id, worker_id, worker_user_id, position_name, employment_type, details, offered_by, application_id)
    values (o.business_id, wid, a.applicant_user_id, left(coalesce(o.position_name, o.title), 120),
            coalesce(nullif(_employment_type,''),'full_time'), left(coalesce(_offer_details,''), 2000), auth.uid(), a.id);
  elsif prev = 'offer' and _status = 'rejected' then
    update public.employment_offers set status = 'withdrawn', updated_at = now() where application_id = a.id and status = 'pending';
  end if;
  perform set_config('umurimo.position_transition', 'on', true);
  update public.applications set status = _status::public.application_status, updated_at = now() where id = a.id;
  perform set_config('umurimo.position_transition', '', true);
  insert into public.application_events(application_id, actor, from_status, to_status, note)
  values (a.id, auth.uid(), prev, _status, left(_note, 1000));
  if _status <> 'offer' then
    insert into public.notifications(user_id, kind, text, link)
    values (a.applicant_user_id, 'application_' || _status,
      'Your application for ' || o.title || ' is now: ' || replace(_status, '_', ' ') || '.', '/positions/' || o.id);
  end if;
  insert into public.notifications(user_id, kind, text, link)
  select bm.user_id, 'applicant_status', 'Applicant moved to ' || replace(_status,'_',' ') || ' for ' || o.title || '.', '/positions/' || o.id || '/applicants'
  from public.business_members bm where bm.business_id = o.business_id and bm.user_id <> auth.uid();
  return _status;
end $$;
revoke all on function public.set_position_application_status(uuid, text, text, text, text) from public, anon;
grant execute on function public.set_position_application_status(uuid, text, text, text, text) to authenticated;

create or replace function public.log_position_withdrawal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'withdrawn' and old.status is distinct from new.status
     and coalesce(current_setting('umurimo.position_transition', true), '') <> 'on'
     and exists (select 1 from public.opportunities where id = new.opportunity_id and type = 'Job') then
    insert into public.application_events(application_id, actor, from_status, to_status) values (new.id, auth.uid(), old.status::text, 'withdrawn');
    update public.employment_offers set status = 'withdrawn', updated_at = now() where application_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
drop trigger if exists position_application_withdrawn on public.applications;
create trigger position_application_withdrawn after update of status on public.applications
for each row execute function public.log_position_withdrawal();

create or replace function public.respond_to_employment_offer(_offer_id uuid, _decision text)
returns public.employment_offers
language plpgsql security definer set search_path = public as $$
declare offer_row public.employment_offers; company_name text;
begin
  if _decision not in ('accepted','declined') then raise exception 'Invalid offer decision'; end if;
  select * into offer_row from public.employment_offers where id = _offer_id for update;
  if not found then raise exception 'Employment offer not found'; end if;
  if offer_row.worker_user_id <> auth.uid() then raise exception 'Only the invited worker can respond' using errcode = '42501'; end if;
  if offer_row.status <> 'pending' then raise exception 'This offer is no longer pending'; end if;
  update public.employment_offers set status = _decision, responded_at = now(), updated_at = now() where id = _offer_id returning * into offer_row;
  select name into company_name from public.businesses where id = offer_row.business_id;
  if offer_row.application_id is not null then
    perform set_config('umurimo.position_transition', 'on', true);
    update public.applications set status = (case when _decision = 'accepted' then 'accepted' else 'withdrawn' end)::public.application_status, updated_at = now()
     where id = offer_row.application_id;
    perform set_config('umurimo.position_transition', '', true);
    insert into public.application_events(application_id, actor, from_status, to_status, note)
    values (offer_row.application_id, auth.uid(), 'offer', case when _decision = 'accepted' then 'accepted' else 'withdrawn' end, 'Offer ' || _decision);
  end if;
  if _decision = 'accepted' then
    if exists (select 1 from public.company_employments where business_id = offer_row.business_id and worker_id = offer_row.worker_id and status = 'active') then
      update public.company_employments set position_name = offer_row.position_name, employment_type = offer_row.employment_type, updated_at = now()
       where business_id = offer_row.business_id and worker_id = offer_row.worker_id and status = 'active';
    else
      insert into public.company_employments(business_id, worker_id, worker_user_id, position_name, employment_type, offer_id, application_id)
      values (offer_row.business_id, offer_row.worker_id, offer_row.worker_user_id, offer_row.position_name, offer_row.employment_type, offer_row.id, offer_row.application_id);
    end if;
  end if;
  insert into public.notifications(user_id, kind, text, link)
  select bm.user_id, 'employment_' || _decision,
    coalesce((select name from public.worker_profiles where id = offer_row.worker_id),'A worker') || ' ' || _decision || ' the ' || offer_row.position_name || ' offer at ' || coalesce(company_name,'your company') || '.',
    '/business/' || offer_row.business_id
  from public.business_members bm where bm.business_id = offer_row.business_id;
  return offer_row;
end $$;
revoke all on function public.respond_to_employment_offer(uuid, text) from public, anon;
grant execute on function public.respond_to_employment_offer(uuid, text) to authenticated;

create or replace function public.end_company_employment(_employment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e record;
begin
  select * into e from public.company_employments where id = _employment_id for update;
  if not found then raise exception 'Employment not found' using errcode = 'P0002'; end if;
  if e.status <> 'active' then raise exception 'Employment already ended'; end if;
  if e.worker_user_id <> auth.uid() and not public.is_business_member(e.business_id, array['owner','manager']) then
    raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.company_employments set status = 'ended', ended_at = current_date, ended_by = auth.uid(), updated_at = now() where id = e.id;
  insert into public.notifications(user_id, kind, text, link)
  select s.u, 'employment_ended', 'Employment as ' || e.position_name || ' has ended.', '/business/' || e.business_id
  from (select e.worker_user_id as u union select user_id from public.business_members where business_id = e.business_id) s
  where s.u <> auth.uid();
end $$;
revoke all on function public.end_company_employment(uuid) from public, anon;
grant execute on function public.end_company_employment(uuid) to authenticated;

create or replace function public.notify_position_referral()
returns trigger language plpgsql security definer set search_path = public as $$
declare o record; ref_user uuid;
begin
  select id, title, business_id, type into o from public.opportunities where id = new.opportunity_id;
  if o.type is distinct from 'Job' then return new; end if;
  select user_id into ref_user from public.worker_profiles where id = new.referee_worker_id;
  if ref_user is not null and ref_user <> new.referrer then
    insert into public.notifications(user_id, kind, text, link)
    values (ref_user, 'position_referral', 'Someone referred you for the position ' || o.title || '. Apply to be considered.', '/positions/' || o.id);
  end if;
  insert into public.notifications(user_id, kind, text, link)
  select bm.user_id, 'position_referral_received', 'New referral for ' || o.title || '.', '/positions/' || o.id || '/applicants'
  from public.business_members bm where bm.business_id = o.business_id;
  return new;
end $$;
drop trigger if exists position_referral_notify on public.referrals;
create trigger position_referral_notify after insert on public.referrals
for each row execute function public.notify_position_referral();

create or replace function public.respond_position_referral(_referral_id uuid, _accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare r record; o record; st text;
begin
  select * into r from public.referrals where id = _referral_id for update;
  if not found then raise exception 'Referral not found' using errcode = 'P0002'; end if;
  select id, title, business_id into o from public.opportunities where id = r.opportunity_id and type = 'Job';
  if not found then raise exception 'Not a position referral'; end if;
  if not public.is_business_member(o.business_id, array['owner','manager','recruiter']) then
    raise exception 'Only authorized company members can respond' using errcode = '42501'; end if;
  st := case when _accept then 'accepted' else 'declined' end;
  update public.referrals set status = st where id = r.id;
  insert into public.notifications(user_id, kind, text, link)
  values (r.referrer, 'referral_' || st, 'Your referral for ' || o.title || ' was ' || st || '. The person still applies through the normal process.', '/positions/' || o.id);
  return st;
end $$;
revoke all on function public.respond_position_referral(uuid, boolean) from public, anon;
grant execute on function public.respond_position_referral(uuid, boolean) to authenticated;

drop policy if exists "position referrals company read" on public.referrals;
create policy "position referrals company read" on public.referrals for select to authenticated
using (exists (select 1 from public.opportunities o where o.id = opportunity_id and o.type = 'Job' and public.is_business_member(o.business_id)));

create index if not exists businesses_sector_idx on public.businesses(sector);
create index if not exists businesses_district_idx on public.businesses(district);
create index if not exists businesses_name_lower_idx on public.businesses(lower(name));
create index if not exists opportunities_business_type_status_idx on public.opportunities(business_id, type, status);

create or replace function public.search_businesses(
  _q text default null, _sector text default null, _district text default null,
  _verified boolean default null, _limit int default 24, _offset int default 0)
returns table(id text, name text, sector text, district text, verified boolean, rating numeric, about text,
              avatar_url text, open_count bigint, total_count bigint)
language sql stable security definer set search_path = public as $$
  with f as (
    select b.* from public.businesses b
    where (_q is null or _q = '' or b.name ilike '%' || _q || '%' or b.about ilike '%' || _q || '%')
      and (_sector is null or _sector = '' or b.sector = _sector)
      and (_district is null or _district = '' or b.district = _district)
      and (_verified is null or b.verified = _verified)
  )
  select f.id, f.name, f.sector, f.district, f.verified, f.rating, f.about,
         (to_jsonb(f) ->> 'avatar_url') as avatar_url,
         (select count(*) from public.opportunities o where o.business_id = f.id and o.status = 'open' and o.deadline >= current_date) as open_count,
         count(*) over() as total_count
  from f order by f.verified desc, lower(f.name), f.id
  limit least(greatest(coalesce(_limit,24),1),100) offset greatest(coalesce(_offset,0),0)
$$;
grant execute on function public.search_businesses(text, text, text, boolean, int, int) to anon, authenticated;
