
-- ========== ENUMS ==========
create type public.app_role as enum ('worker','team_lead','business','learner','admin','institution');
create type public.application_status as enum ('submitted','viewed','shortlisted','rejected','accepted','withdrawn');

-- ========== PROFILES & ROLES ==========
create table public.profiles (
  id uuid primary key,
  display_name text not null check (char_length(display_name) between 1 and 80),
  phone text check (phone is null or phone ~ '^\+2507\d{8}$'),
  phone_verified boolean not null default false,
  district text,
  locale text not null default 'en' check (locale in ('en','rw','fr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid() and phone_verified = false);
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "self-assign basic roles" on public.user_roles for insert to authenticated
  with check (user_id = auth.uid() and role in ('worker','team_lead','business','learner'));
create policy "admin manage roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "remove own basic role" on public.user_roles for delete to authenticated
  using ((user_id = auth.uid() and role in ('worker','team_lead','business','learner')) or public.has_role(auth.uid(),'admin'));

-- ========== WORKERS ==========
create table public.worker_profiles (
  id text primary key default gen_random_uuid()::text,
  user_id uuid unique,
  name text not null check (char_length(name) between 1 and 80),
  title text not null default '' check (char_length(title) <= 120),
  district text not null,
  sector text not null,
  rate_rwf integer not null default 0 check (rate_rwf >= 0),
  rate_unit text not null default 'day' check (rate_unit in ('day','hour','project')),
  available boolean not null default true,
  years integer not null default 0 check (years between 0 and 80),
  bio text not null default '' check (char_length(bio) <= 1000),
  initials text not null default '',
  verified boolean not null default false,
  rating numeric(2,1) not null default 0,
  reviews integer not null default 0,
  rep jsonb not null default '{"completion":0,"onTime":0,"repeat":0,"verifiedProjects":0,"skillsVerified":0,"recommendations":0,"response":0}',
  visibility text not null default 'public' check (visibility in ('public','network','private')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.worker_profiles (district); create index on public.worker_profiles (sector);
grant select on public.worker_profiles to anon;
grant select, insert, update, delete on public.worker_profiles to authenticated;
grant all on public.worker_profiles to service_role;
alter table public.worker_profiles enable row level security;
create policy "public workers readable" on public.worker_profiles for select to anon, authenticated using (visibility = 'public' or user_id = auth.uid());
create policy "own worker insert" on public.worker_profiles for insert to authenticated with check (user_id = auth.uid() and verified = false and is_demo = false);
create policy "own worker update" on public.worker_profiles for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own worker delete" on public.worker_profiles for delete to authenticated using (user_id = auth.uid());

create or replace function public.my_worker_id() returns text language sql stable security definer set search_path = public as $$
  select id from public.worker_profiles where user_id = auth.uid() limit 1
$$;

create table public.worker_skills (
  id uuid primary key default gen_random_uuid(),
  worker_id text not null references public.worker_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  level text not null default 'Beginner' check (level in ('Beginner','Intermediate','Advanced','Expert')),
  verification text not null default 'Self-declared' check (verification in ('Self-declared','Certificate','Assessment','Employer','Platform')),
  unique (worker_id, name)
);
create index on public.worker_skills (worker_id);
grant select on public.worker_skills to anon;
grant select, insert, update, delete on public.worker_skills to authenticated;
grant all on public.worker_skills to service_role;
alter table public.worker_skills enable row level security;
create policy "skills readable" on public.worker_skills for select to anon, authenticated using (exists (select 1 from public.worker_profiles w where w.id = worker_id and (w.visibility='public' or w.user_id = auth.uid())));
create policy "own skills write" on public.worker_skills for all to authenticated
  using (worker_id = public.my_worker_id() or public.has_role(auth.uid(),'admin'))
  with check (worker_id = public.my_worker_id() or public.has_role(auth.uid(),'admin'));

-- ========== BUSINESSES ==========
create table public.businesses (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(name) between 2 and 120),
  sector text not null,
  district text not null,
  verified boolean not null default false,
  rating numeric(2,1) not null default 0,
  about text not null default '' check (char_length(about) <= 1000),
  services text[] not null default '{}',
  is_demo boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.businesses to anon;
grant select, insert, update, delete on public.businesses to authenticated;
grant all on public.businesses to service_role;
alter table public.businesses enable row level security;

create table public.business_members (
  business_id text not null references public.businesses(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner' check (role in ('owner','manager','recruiter')),
  primary key (business_id, user_id)
);
create index on public.business_members (user_id);
grant select, insert, delete on public.business_members to authenticated;
grant all on public.business_members to service_role;
alter table public.business_members enable row level security;

create or replace function public.is_business_member(_bid text, _roles text[] default array['owner','manager','recruiter'])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members where business_id = _bid and user_id = auth.uid() and role = any(_roles))
$$;

create policy "businesses readable" on public.businesses for select to anon, authenticated using (true);
create policy "create business" on public.businesses for insert to authenticated with check (created_by = auth.uid() and verified = false and is_demo = false);
create policy "managers update business" on public.businesses for update to authenticated
  using (public.is_business_member(id, array['owner','manager']) or public.has_role(auth.uid(),'admin'))
  with check (public.is_business_member(id, array['owner','manager']) or public.has_role(auth.uid(),'admin'));
create policy "owner delete business" on public.businesses for delete to authenticated using (public.is_business_member(id, array['owner']));

create policy "members read" on public.business_members for select to authenticated using (user_id = auth.uid() or public.is_business_member(business_id));
create policy "creator becomes owner" on public.business_members for insert to authenticated
  with check ((user_id = auth.uid() and role='owner' and exists (select 1 from public.businesses b where b.id = business_id and b.created_by = auth.uid()))
    or public.is_business_member(business_id, array['owner']));
create policy "owner removes members" on public.business_members for delete to authenticated using (public.is_business_member(business_id, array['owner']) or user_id = auth.uid());

-- ========== TEAMS ==========
create table public.teams (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(name) between 2 and 120),
  lead_worker_id text references public.worker_profiles(id) on delete set null,
  lead_user_id uuid,
  sector text not null,
  areas text[] not null default '{}',
  rating numeric(2,1) not null default 0,
  projects integer not null default 0,
  available boolean not null default true,
  summary text not null default '' check (char_length(summary) <= 1000),
  skills text[] not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.teams to anon;
grant select, insert, update, delete on public.teams to authenticated;
grant all on public.teams to service_role;
alter table public.teams enable row level security;
create policy "teams readable" on public.teams for select to anon, authenticated using (true);
create policy "lead creates team" on public.teams for insert to authenticated with check (lead_user_id = auth.uid() and is_demo = false and rating = 0 and projects = 0);
create policy "lead updates team" on public.teams for update to authenticated using (lead_user_id = auth.uid()) with check (lead_user_id = auth.uid());
create policy "lead deletes team" on public.teams for delete to authenticated using (lead_user_id = auth.uid());

create table public.team_members (
  team_id text not null references public.teams(id) on delete cascade,
  worker_id text not null references public.worker_profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('lead','member')),
  status text not null default 'invited' check (status in ('invited','active','left')),
  joined_at timestamptz not null default now(),
  primary key (team_id, worker_id)
);
grant select on public.team_members to anon;
grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;
alter table public.team_members enable row level security;
create or replace function public.is_team_lead(_tid text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teams where id = _tid and lead_user_id = auth.uid())
$$;
create policy "active members readable" on public.team_members for select to anon, authenticated using (status = 'active' or worker_id = public.my_worker_id() or public.is_team_lead(team_id));
create policy "lead invites" on public.team_members for insert to authenticated with check (public.is_team_lead(team_id));
create policy "lead or member updates" on public.team_members for update to authenticated
  using (public.is_team_lead(team_id) or worker_id = public.my_worker_id())
  with check (public.is_team_lead(team_id) or worker_id = public.my_worker_id());
create policy "lead removes" on public.team_members for delete to authenticated using (public.is_team_lead(team_id) or worker_id = public.my_worker_id());

-- ========== OPPORTUNITIES ==========
create table public.opportunities (
  id text primary key default gen_random_uuid()::text,
  business_id text not null references public.businesses(id) on delete cascade,
  created_by uuid,
  title text not null check (char_length(title) between 4 and 140),
  sector text not null,
  district text not null,
  type text not null check (type in ('Job','Project','Gig','Apprenticeship','Seasonal')),
  pay_rwf integer not null check (pay_rwf > 0),
  pay_unit text not null check (pay_unit in ('day','month','project')),
  mode text not null check (mode in ('On-site','Remote','Hybrid')),
  duration text not null default '',
  deadline date not null,
  team_allowed boolean not null default false,
  team_size integer check (team_size is null or team_size between 1 and 500),
  skills text[] not null default '{}',
  summary text not null default '' check (char_length(summary) <= 2000),
  responsibilities text[] not null default '{}',
  requirements text[] not null default '{}',
  featured boolean not null default false,
  status text not null default 'open' check (status in ('draft','open','closed','filled')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.opportunities (business_id); create index on public.opportunities (status, deadline);
create index on public.opportunities (sector); create index on public.opportunities (district);
grant select on public.opportunities to anon;
grant select, insert, update, delete on public.opportunities to authenticated;
grant all on public.opportunities to service_role;
alter table public.opportunities enable row level security;
create policy "open opps public" on public.opportunities for select to anon, authenticated using (status in ('open','filled','closed'));
create policy "members see own drafts" on public.opportunities for select to authenticated using (public.is_business_member(business_id) or public.has_role(auth.uid(),'admin'));
create policy "members create opps" on public.opportunities for insert to authenticated with check (public.is_business_member(business_id) and created_by = auth.uid() and featured = false and is_demo = false);
create policy "members update opps" on public.opportunities for update to authenticated
  using (public.is_business_member(business_id) or public.has_role(auth.uid(),'admin'))
  with check (public.is_business_member(business_id) or public.has_role(auth.uid(),'admin'));
create policy "members delete opps" on public.opportunities for delete to authenticated using (public.is_business_member(business_id, array['owner','manager']));

-- ========== APPLICATIONS ==========
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null references public.opportunities(id) on delete cascade,
  applicant_user_id uuid not null,
  team_id text references public.teams(id) on delete set null,
  kind text not null check (kind in ('Individual','Team','Referral','Invitation','Rehire')),
  note text not null default '' check (char_length(note) <= 2000),
  status public.application_status not null default 'submitted',
  referred_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, applicant_user_id)
);
create index on public.applications (applicant_user_id);
grant select, insert, update on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "applicant reads" on public.applications for select to authenticated using (applicant_user_id = auth.uid());
create policy "business reads" on public.applications for select to authenticated using (exists (select 1 from public.opportunities o where o.id = opportunity_id and public.is_business_member(o.business_id)));
create policy "apply" on public.applications for insert to authenticated with check (
  applicant_user_id = auth.uid() and status = 'submitted'
  and (team_id is null or public.is_team_lead(team_id))
  and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.status = 'open'));
create policy "applicant or business updates" on public.applications for update to authenticated
  using (applicant_user_id = auth.uid() or exists (select 1 from public.opportunities o where o.id = opportunity_id and public.is_business_member(o.business_id)));

-- ========== SAVED ==========
create table public.saved_opportunities (
  user_id uuid not null, opportunity_id text not null references public.opportunities(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, opportunity_id)
);
grant select, insert, delete on public.saved_opportunities to authenticated;
grant all on public.saved_opportunities to service_role;
alter table public.saved_opportunities enable row level security;
create policy "own saved" on public.saved_opportunities for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ========== TRUST NETWORK ==========
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null, addressee uuid not null,
  relation text not null default 'worked_with' check (relation in ('worked_with','trained_with','employer','community')),
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  check (requester <> addressee), unique (requester, addressee)
);
grant select, insert, update, delete on public.connections to authenticated;
grant all on public.connections to service_role;
alter table public.connections enable row level security;
create policy "parties read" on public.connections for select to authenticated using (auth.uid() in (requester, addressee));
create policy "request" on public.connections for insert to authenticated with check (requester = auth.uid() and status = 'pending');
create policy "addressee responds" on public.connections for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy "either removes" on public.connections for delete to authenticated using (auth.uid() in (requester, addressee));

create or replace function public.are_connected(_a uuid, _b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.connections where status='accepted' and ((requester=_a and addressee=_b) or (requester=_b and addressee=_a)))
$$;

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer uuid not null, referee_worker_id text not null references public.worker_profiles(id) on delete cascade,
  opportunity_id text not null references public.opportunities(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'sent' check (status in ('sent','applied','declined')),
  created_at timestamptz not null default now(),
  unique (referrer, referee_worker_id, opportunity_id)
);
grant select, insert, update on public.referrals to authenticated;
grant all on public.referrals to service_role;
alter table public.referrals enable row level security;
create policy "referral parties read" on public.referrals for select to authenticated using (referrer = auth.uid() or referee_worker_id = public.my_worker_id());
create policy "refer" on public.referrals for insert to authenticated with check (referrer = auth.uid() and referee_worker_id <> coalesce(public.my_worker_id(),''));
create policy "referee updates" on public.referrals for update to authenticated using (referee_worker_id = public.my_worker_id());

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null, to_user uuid not null,
  skill text not null check (char_length(skill) between 1 and 60),
  body text not null check (char_length(body) between 5 and 600),
  created_at timestamptz not null default now(),
  check (from_user <> to_user), unique (from_user, to_user, skill)
);
grant select, insert, delete on public.recommendations to authenticated;
grant all on public.recommendations to service_role;
alter table public.recommendations enable row level security;
create policy "rec parties read" on public.recommendations for select to authenticated using (auth.uid() in (from_user, to_user));
create policy "recommend connected" on public.recommendations for insert to authenticated with check (from_user = auth.uid() and public.are_connected(from_user, to_user));
create policy "author deletes" on public.recommendations for delete to authenticated using (from_user = auth.uid());

-- ========== AUDIT + PROTECTED COLUMNS ==========
create table public.audit_log (
  id bigserial primary key, actor uuid, action text not null, entity text not null, entity_id text, at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admins read audit" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.guard_protected_columns() returns trigger language plpgsql security definer set search_path = public as $$
declare is_admin boolean := coalesce(public.has_role(auth.uid(),'admin'), false) or auth.uid() is null;
begin
  if tg_table_name = 'worker_profiles' then
    if (new.verified is distinct from old.verified or new.rating is distinct from old.rating or new.reviews is distinct from old.reviews or new.rep is distinct from old.rep or new.is_demo is distinct from old.is_demo or new.user_id is distinct from old.user_id) and not is_admin then
      raise exception 'Only admins can change verification or reputation fields'; end if;
    if new.verified is distinct from old.verified then insert into audit_log(actor,action,entity,entity_id) values (auth.uid(),'verify','worker',new.id); end if;
  elsif tg_table_name = 'businesses' then
    if (new.verified is distinct from old.verified or new.rating is distinct from old.rating or new.is_demo is distinct from old.is_demo) and not is_admin then
      raise exception 'Only admins can verify businesses'; end if;
    if new.verified is distinct from old.verified then insert into audit_log(actor,action,entity,entity_id) values (auth.uid(),'verify','business',new.id); end if;
  elsif tg_table_name = 'opportunities' then
    if (new.featured is distinct from old.featured or new.is_demo is distinct from old.is_demo or new.business_id is distinct from old.business_id) and not is_admin then
      raise exception 'Only admins can feature opportunities'; end if;
  elsif tg_table_name = 'teams' then
    if (new.rating is distinct from old.rating or new.projects is distinct from old.projects or new.is_demo is distinct from old.is_demo) and not is_admin then
      raise exception 'Team reputation is system-managed'; end if;
  end if;
  return new;
end $$;
create trigger guard_workers before update on public.worker_profiles for each row execute function public.guard_protected_columns();
create trigger guard_businesses before update on public.businesses for each row execute function public.guard_protected_columns();
create trigger guard_opps before update on public.opportunities for each row execute function public.guard_protected_columns();
create trigger guard_teams before update on public.teams for each row execute function public.guard_protected_columns();

create or replace function public.guard_skill_verification() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification <> 'Self-declared' and auth.uid() is not null
     and not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'institution'))
     and (tg_op = 'INSERT' or new.verification is distinct from old.verification) then
    raise exception 'Only admins or institutions can verify skills';
  end if;
  return new;
end $$;
create trigger guard_skills before insert or update on public.worker_skills for each row execute function public.guard_skill_verification();

-- Applications: applicant may only withdraw; business may only move status; nobody else changes identity fields
create or replace function public.guard_application_update() returns trigger language plpgsql security definer set search_path = public as $$
declare is_biz boolean;
begin
  if new.opportunity_id <> old.opportunity_id or new.applicant_user_id <> old.applicant_user_id or new.kind <> old.kind then
    raise exception 'Immutable application fields'; end if;
  select public.is_business_member(o.business_id) into is_biz from public.opportunities o where o.id = new.opportunity_id;
  if new.status is distinct from old.status then
    if auth.uid() = old.applicant_user_id and not coalesce(is_biz,false) then
      if new.status <> 'withdrawn' then raise exception 'Applicants can only withdraw'; end if;
    elsif not coalesce(is_biz,false) then raise exception 'Not allowed';
    elsif new.status = 'withdrawn' then raise exception 'Only applicants can withdraw'; end if;
  end if;
  if auth.uid() <> old.applicant_user_id and new.note is distinct from old.note then raise exception 'Not allowed'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger guard_app before update on public.applications for each row execute function public.guard_application_update();

-- Validation trigger: deadline must be in future on insert
create or replace function public.validate_opportunity() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.is_demo = false and new.deadline < current_date then raise exception 'Deadline must be in the future'; end if;
  if not new.team_allowed then new.team_size := null; end if;
  return new;
end $$;
create trigger validate_opp before insert or update on public.opportunities for each row execute function public.validate_opportunity();

-- Public aggregate: accepted connections count per worker
create or replace function public.worker_network_count(_worker_id text) returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.connections c join public.worker_profiles w on w.user_id in (c.requester, c.addressee)
  where w.id = _worker_id and c.status = 'accepted'
$$;
grant execute on function public.worker_network_count(text) to anon, authenticated;
