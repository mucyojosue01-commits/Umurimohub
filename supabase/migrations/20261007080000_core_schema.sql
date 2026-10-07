-- UmurimoHub core relational foundation
-- Reconstructed as the source-controlled base for the existing application schema.
-- Phase A/B/C migrations depend on this foundation.

create extension if not exists pgcrypto;

create type public.app_role as enum ('worker','team_lead','business','learner','admin','institution');
create type public.application_status as enum ('submitted','viewed','shortlisted','rejected','accepted','withdrawn');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
  district text,
  locale text not null default 'en',
  phone text,
  phone_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.worker_profiles (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  initials text not null default '',
  title text not null default '',
  bio text not null default '',
  district text not null,
  sector text not null,
  rate_rwf bigint not null default 0 check (rate_rwf >= 0),
  rate_unit text not null default 'project',
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  reviews integer not null default 0 check (reviews >= 0),
  rep jsonb not null default '{}'::jsonb,
  years integer not null default 0 check (years >= 0),
  available boolean not null default true,
  verified boolean not null default false,
  visibility text not null default 'public',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.worker_skills (
  id text primary key default gen_random_uuid()::text,
  worker_id text not null references public.worker_profiles(id) on delete cascade,
  name text not null,
  level text not null default 'intermediate',
  verification text not null default 'self_reported'
);

create table public.businesses (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  about text not null default '',
  district text not null,
  sector text not null,
  services text[] not null default '{}',
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  verified boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id text not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  primary key (business_id, user_id)
);

create table public.teams (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  summary text not null default '',
  sector text not null,
  skills text[] not null default '{}',
  areas text[] not null default '{}',
  lead_user_id uuid references auth.users(id) on delete set null,
  lead_worker_id text references public.worker_profiles(id) on delete set null,
  projects integer not null default 0 check (projects >= 0),
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  available boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id text not null references public.teams(id) on delete cascade,
  worker_id text not null references public.worker_profiles(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (team_id, worker_id)
);

create table public.opportunities (
  id text primary key default gen_random_uuid()::text,
  business_id text not null references public.businesses(id) on delete restrict,
  title text not null,
  summary text not null default '',
  sector text not null,
  district text not null,
  type text not null,
  mode text not null,
  duration text not null default '',
  pay_rwf bigint not null check (pay_rwf >= 0),
  pay_unit text not null,
  deadline date not null,
  skills text[] not null default '{}',
  responsibilities text[] not null default '{}',
  requirements text[] not null default '{}',
  team_allowed boolean not null default false,
  team_size integer check (team_size is null or team_size > 0),
  status text not null default 'open',
  featured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null references public.opportunities(id) on delete restrict,
  applicant_user_id uuid not null references auth.users(id) on delete restrict,
  team_id text references public.teams(id) on delete restrict,
  kind text not null default 'individual',
  note text not null default '',
  referred_by uuid references auth.users(id) on delete set null,
  status public.application_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((team_id is null and kind <> 'team') or team_id is not null)
);

create table public.saved_opportunities (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id text not null references public.opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  relation text not null default 'connection',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null references public.opportunities(id) on delete restrict,
  referee_worker_id text not null references public.worker_profiles(id) on delete restrict,
  referrer uuid not null references auth.users(id) on delete restrict,
  note text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete restrict,
  to_user uuid not null references auth.users(id) on delete restrict,
  skill text not null,
  body text not null,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  at timestamptz not null default now()
);

create index worker_profiles_user_idx on public.worker_profiles(user_id);
create index worker_profiles_district_idx on public.worker_profiles(district);
create index businesses_created_by_idx on public.businesses(created_by);
create index business_members_user_idx on public.business_members(user_id);
create index teams_lead_user_idx on public.teams(lead_user_id);
create index team_members_worker_idx on public.team_members(worker_id);
create index opportunities_business_idx on public.opportunities(business_id);
create index opportunities_deadline_idx on public.opportunities(deadline);
create index applications_opportunity_idx on public.applications(opportunity_id);
create index applications_applicant_idx on public.applications(applicant_user_id);
create index connections_user_idx on public.connections(requester, addressee);
create index recommendations_to_user_idx on public.recommendations(to_user);

create or replace function public.has_role(_role public.app_role, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = _user_id and ur.role = _role);
$$;

create or replace function public.my_worker_id()
returns text language sql stable security definer set search_path = public as $$
  select wp.id from public.worker_profiles wp where wp.user_id = auth.uid() limit 1;
$$;

create or replace function public.is_business_member(_bid text, _roles text[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members bm
    where bm.business_id = _bid
      and bm.user_id = auth.uid()
      and (_roles is null or bm.role = any(_roles))
  );
$$;

create or replace function public.is_team_lead(_tid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.teams t
    where t.id = _tid and t.lead_user_id = auth.uid()
  );
$$;

create or replace function public.are_connected(_a text, _b text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester::text = _a and c.addressee::text = _b)
        or (c.requester::text = _b and c.addressee::text = _a))
  );
$$;

create or replace function public.worker_network_count(_worker_id text)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer
  from public.connections c
  join public.worker_profiles a on a.user_id = c.requester
  join public.worker_profiles b on b.user_id = c.addressee
  where c.status = 'accepted' and (a.id = _worker_id or b.id = _worker_id);
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.worker_skills enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.opportunities enable row level security;
alter table public.applications enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.connections enable row level security;
alter table public.referrals enable row level security;
alter table public.recommendations enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles self read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles self insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "roles self read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role('admin', auth.uid()));

create policy "workers public read" on public.worker_profiles for select to anon, authenticated using (visibility = 'public' or user_id = auth.uid() or public.has_role('admin', auth.uid()));
create policy "workers self update" on public.worker_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "worker skills public read" on public.worker_skills for select to anon, authenticated using (
  exists (select 1 from public.worker_profiles w where w.id = worker_id and (w.visibility = 'public' or w.user_id = auth.uid() or public.has_role('admin', auth.uid())))
);

create policy "businesses public read" on public.businesses for select to anon, authenticated using (true);
create policy "business members self read" on public.business_members for select to authenticated using (user_id = auth.uid() or public.is_business_member(business_id));
create policy "teams public read" on public.teams for select to anon, authenticated using (true);
create policy "team members public read" on public.team_members for select to anon, authenticated using (true);

create policy "opportunities public read" on public.opportunities for select to anon, authenticated using (status <> 'draft' or created_by = auth.uid());
create policy "applications parties read" on public.applications for select to authenticated using (
  applicant_user_id = auth.uid()
  or public.is_business_member((select o.business_id from public.opportunities o where o.id = opportunity_id))
  or (team_id is not null and public.is_team_lead(team_id))
);
create policy "applications applicant insert" on public.applications for insert to authenticated with check (applicant_user_id = auth.uid());
create policy "applications applicant update" on public.applications for update to authenticated using (applicant_user_id = auth.uid()) with check (applicant_user_id = auth.uid());

create policy "saved own read" on public.saved_opportunities for select to authenticated using (user_id = auth.uid());
create policy "saved own insert" on public.saved_opportunities for insert to authenticated with check (user_id = auth.uid());
create policy "saved own delete" on public.saved_opportunities for delete to authenticated using (user_id = auth.uid());

create policy "connections participants read" on public.connections for select to authenticated using (requester = auth.uid() or addressee = auth.uid());
create policy "connections requester insert" on public.connections for insert to authenticated with check (requester = auth.uid());
create policy "connections participants update" on public.connections for update to authenticated
using (requester = auth.uid() or addressee = auth.uid())
with check (requester = auth.uid() or addressee = auth.uid());

create policy "referrals parties read" on public.referrals for select to authenticated using (
  referrer = auth.uid()
  or exists (select 1 from public.worker_profiles w where w.id = referee_worker_id and w.user_id = auth.uid())
  or public.is_business_member((select o.business_id from public.opportunities o where o.id = opportunity_id))
);
create policy "referrals referrer insert" on public.referrals for insert to authenticated with check (referrer = auth.uid());

create policy "recommendations participants read" on public.recommendations for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());
create policy "recommendations author insert" on public.recommendations for insert to authenticated with check (from_user = auth.uid());

create policy "audit admin read" on public.audit_log for select to authenticated using (public.has_role('admin', auth.uid()));

revoke all on function public.has_role(public.app_role, uuid) from public, anon;
revoke all on function public.my_worker_id() from public, anon;
revoke all on function public.is_business_member(text, text[]) from public, anon;
revoke all on function public.is_team_lead(text) from public, anon;
revoke all on function public.are_connected(text,text) from public, anon;
revoke all on function public.worker_network_count(text) from public, anon;
grant execute on function public.has_role(public.app_role, uuid) to authenticated;
grant execute on function public.my_worker_id() to authenticated;
grant execute on function public.is_business_member(text, text[]) to authenticated;
grant execute on function public.is_team_lead(text) to authenticated;
grant execute on function public.are_connected(text,text) to authenticated;
grant execute on function public.worker_network_count(text) to authenticated;
