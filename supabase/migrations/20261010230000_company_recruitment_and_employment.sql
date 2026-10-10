-- Company Positions are a distinct opportunity type; employment is recorded separately
-- so project completion and employment history cannot be confused.
alter table public.opportunities
  add column if not exists opportunity_type text not null default 'project'
    check (opportunity_type in ('project','service','company_position')),
  add column if not exists position_name text;

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

create index if not exists employment_offers_worker_idx on public.employment_offers(worker_user_id, status, created_at desc);
create index if not exists company_employments_business_idx on public.company_employments(business_id, status, created_at desc);
create index if not exists company_employments_worker_idx on public.company_employments(worker_id, status, created_at desc);

alter table public.employment_offers enable row level security;
alter table public.company_employments enable row level security;

drop policy if exists "employment offers parties read" on public.employment_offers;
create policy "employment offers parties read" on public.employment_offers for select to authenticated
using (worker_user_id = auth.uid() or public.is_business_member(business_id) or public.has_role('admin'::public.app_role, auth.uid()));

drop policy if exists "business members create employment offers" on public.employment_offers;
create policy "business members create employment offers" on public.employment_offers for insert to authenticated
with check (public.is_business_member(business_id) and offered_by = auth.uid());

drop policy if exists "company employments public active read" on public.company_employments;
create policy "company employments public active read" on public.company_employments for select to authenticated
using (status = 'active' or worker_user_id = auth.uid() or public.is_business_member(business_id) or public.has_role('admin'::public.app_role, auth.uid()));

grant select, insert on public.employment_offers to authenticated;
grant select on public.company_employments to authenticated;

create or replace function public.respond_to_employment_offer(_offer_id uuid, _decision text)
returns public.employment_offers
language plpgsql security definer set search_path = public
as $$
declare
  offer_row public.employment_offers;
  company_name text;
begin
  if _decision not in ('accepted','declined') then raise exception 'Invalid offer decision'; end if;
  select * into offer_row from public.employment_offers where id = _offer_id for update;
  if not found then raise exception 'Employment offer not found'; end if;
  if offer_row.worker_user_id <> auth.uid() then raise exception 'Only the invited worker can respond'; end if;
  if offer_row.status <> 'pending' then raise exception 'This offer is no longer pending'; end if;
  update public.employment_offers set status = _decision, responded_at = now(), updated_at = now() where id = _offer_id returning * into offer_row;
  if _decision = 'accepted' then
    insert into public.company_employments(business_id, worker_id, worker_user_id, position_name, employment_type, offer_id)
    values (offer_row.business_id, offer_row.worker_id, offer_row.worker_user_id, offer_row.position_name, offer_row.employment_type, offer_row.id)
    on conflict (offer_id) do update set position_name = excluded.position_name, status = 'active', ended_at = null, updated_at = now();
    select name into company_name from public.businesses where id = offer_row.business_id;
    insert into public.notifications(user_id, kind, text, link)
    select bm.user_id, 'employment_accepted', coalesce((select name from public.worker_profiles where id = offer_row.worker_id),'A worker') || ' accepted the ' || offer_row.position_name || ' position at ' || coalesce(company_name,'your company') || '.', '/business/' || offer_row.business_id
    from public.business_members bm where bm.business_id = offer_row.business_id and bm.user_id <> auth.uid();
  end if;
  return offer_row;
end;
$$;

revoke all on function public.respond_to_employment_offer(uuid, text) from public, anon;
grant execute on function public.respond_to_employment_offer(uuid, text) to authenticated;

create or replace function public.notify_employment_offer_created()
returns trigger language plpgsql security definer set search_path = public
as $$
declare company_name text;
begin
  select name into company_name from public.businesses where id = new.business_id;
  insert into public.notifications(user_id, kind, text, link)
  values (new.worker_user_id, 'employment_offer', coalesce(company_name,'A company') || ' invited you to join as ' || new.position_name || '.', '/notifications');
  return new;
end;
$$;

drop trigger if exists employment_offer_notify_worker on public.employment_offers;
create trigger employment_offer_notify_worker after insert on public.employment_offers
for each row execute function public.notify_employment_offer_created();
