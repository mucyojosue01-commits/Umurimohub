-- Production integrity: actor-aware applications, avatars, multi-districts and change acknowledgements.
alter table public.profiles add column if not exists avatar_url text;
alter table public.businesses add column if not exists avatar_url text;
alter table public.teams add column if not exists avatar_url text;
alter table public.worker_profiles add column if not exists avatar_url text;

create table if not exists public.worker_districts (worker_id text not null references public.worker_profiles(id) on delete cascade,district text not null,created_at timestamptz not null default now(),primary key(worker_id,district));
create table if not exists public.team_districts (team_id text not null references public.teams(id) on delete cascade,district text not null,created_at timestamptz not null default now(),primary key(team_id,district));
create table if not exists public.business_districts (business_id text not null references public.businesses(id) on delete cascade,district text not null,created_at timestamptz not null default now(),primary key(business_id,district));

alter table public.opportunities add column if not exists eligible_actor_types text[] not null default array['individual','team','business'];
alter table public.opportunities add column if not exists version integer not null default 1;
alter table public.opportunities add column if not exists updated_at timestamptz not null default now();
alter table public.opportunities add column if not exists change_note text;

alter table public.applications add column if not exists applicant_type text;
alter table public.applications add column if not exists applicant_business_id text references public.businesses(id) on delete restrict;
alter table public.applications add column if not exists applicant_team_id text references public.teams(id) on delete restrict;
update public.applications set applicant_type=case when kind='team' then 'team' else 'individual' end where applicant_type is null;
alter table public.applications alter column applicant_type set default 'individual';
alter table public.applications alter column applicant_type set not null;

create unique index if not exists applications_identity_unique on public.applications(opportunity_id,applicant_user_id,applicant_type,coalesce(applicant_team_id,''),coalesce(applicant_business_id,''));
create index if not exists applications_actor_idx on public.applications(opportunity_id,applicant_type);
create index if not exists worker_districts_district_idx on public.worker_districts(district);
create index if not exists team_districts_district_idx on public.team_districts(district);
create index if not exists business_districts_district_idx on public.business_districts(district);

create table if not exists public.opportunity_change_acknowledgements(
 id uuid primary key default gen_random_uuid(),
 opportunity_id text not null references public.opportunities(id) on delete cascade,
 application_id uuid not null references public.applications(id) on delete cascade,
 user_id uuid not null, version integer not null,
 decision text not null check(decision in('pending','accepted','rejected')),
 responded_at timestamptz, created_at timestamptz not null default now(),
 unique(application_id,version)
);
create index if not exists opportunity_ack_user_idx on public.opportunity_change_acknowledgements(user_id,decision);

create table if not exists public.team_removal_events(
 id uuid primary key default gen_random_uuid(),
 team_id text not null references public.teams(id) on delete cascade,
 worker_id text not null references public.worker_profiles(id) on delete cascade,
 removed_by uuid not null,
 reason text not null check(char_length(btrim(reason))>=1),
 created_at timestamptz not null default now()
);

alter table public.worker_districts enable row level security;
alter table public.team_districts enable row level security;
alter table public.business_districts enable row level security;
alter table public.opportunity_change_acknowledgements enable row level security;
alter table public.team_removal_events enable row level security;

create policy "worker districts public read" on public.worker_districts for select to anon,authenticated using(true);
create policy "team districts public read" on public.team_districts for select to anon,authenticated using(true);
create policy "business districts public read" on public.business_districts for select to anon,authenticated using(true);
create policy "opportunity acknowledgements participants read" on public.opportunity_change_acknowledgements for select to authenticated using(user_id=auth.uid() or public.is_business_member((select o.business_id from public.opportunities o where o.id=opportunity_id)));
create policy "opportunity acknowledgements applicant update" on public.opportunity_change_acknowledgements for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "team removal events affected read" on public.team_removal_events for select to authenticated using(exists(select 1 from public.worker_profiles w where w.id=worker_id and w.user_id=auth.uid()) or public.is_team_lead(team_id,auth.uid()));

create or replace function public.apply_as_actor(_opportunity_id text,_applicant_type text,_note text default '',_team_id text default null,_business_id text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); app_id uuid; opp record;
begin
 if uid is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 select * into opp from public.opportunities where id=_opportunity_id and status='open' for update;
 if not found then raise exception 'Opportunity not available' using errcode='P0002'; end if;
 if _applicant_type not in('individual','team','business') then raise exception 'Invalid applicant type'; end if;
 if not (_applicant_type=any(opp.eligible_actor_types)) then raise exception 'This opportunity does not accept this applicant type'; end if;
 if _applicant_type='team' and (_team_id is null or not public.is_team_lead(_team_id,uid)) then raise exception 'You must lead the selected team' using errcode='42501'; end if;
 if _applicant_type='business' and (_business_id is null or not public.is_business_member(_business_id,array['owner','admin','member'])) then raise exception 'You are not a member of the selected business' using errcode='42501'; end if;
 if _applicant_type='individual' and exists(select 1 from public.applications a where a.opportunity_id=_opportunity_id and a.applicant_user_id=uid and a.applicant_type in('team','business') and a.status not in('withdrawn','rejected')) then raise exception 'You already applied here as a team or business; withdraw that application before applying individually'; end if;
 if _applicant_type in('team','business') and exists(select 1 from public.applications a where a.opportunity_id=_opportunity_id and a.applicant_user_id=uid and a.applicant_type='individual' and a.status not in('withdrawn','rejected')) then raise exception 'You already applied individually here; withdraw that application before applying as another actor'; end if;
 insert into public.applications(opportunity_id,applicant_user_id,team_id,applicant_team_id,applicant_business_id,applicant_type,kind,note)
 values(_opportunity_id,uid,_team_id,_team_id,_business_id,_applicant_type,case when _applicant_type='team' then 'team' when _applicant_type='business' then 'business' else 'individual' end,left(coalesce(_note,''),2000))
 returning id into app_id;
 return app_id;
end $$;
revoke all on function public.apply_as_actor(text,text,text,text,text) from public,anon;
grant execute on function public.apply_as_actor(text,text,text,text,text) to authenticated;

create or replace function public.accept_team_invitation(_team_id text,_worker_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 if not exists(select 1 from public.worker_profiles where id=_worker_id and user_id=auth.uid()) then raise exception 'Not your worker profile' using errcode='42501'; end if;
 update public.team_members set status='active' where team_id=_team_id and worker_id=_worker_id and status='invited';
 if not found then raise exception 'Invitation not found'; end if;
end $$;
revoke all on function public.accept_team_invitation(text,text) from public,anon;
grant execute on function public.accept_team_invitation(text,text) to authenticated;

create or replace function public.remove_team_member(_team_id text,_worker_id text,_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_team_lead(_team_id,auth.uid()) then raise exception 'Only the team lead can remove members' using errcode='42501'; end if;
 if char_length(btrim(coalesce(_reason,'')))<1 then raise exception 'A reason is required'; end if;
 update public.team_members set status='removed' where team_id=_team_id and worker_id=_worker_id and status='active';
 if not found then raise exception 'Active team member not found'; end if;
 insert into public.team_removal_events(team_id,worker_id,removed_by,reason) values(_team_id,_worker_id,auth.uid(),left(btrim(_reason),1000));
 insert into public.notifications(user_id,kind,text,link)
 select wp.user_id,'team_removed','You were removed from the team: '||t.name||'. Reason: '||left(btrim(_reason),500),'/dashboard'
 from public.worker_profiles wp join public.teams t on t.id=_team_id where wp.id=_worker_id and wp.user_id is not null;
end $$;
revoke all on function public.remove_team_member(text,text,text) from public,anon;
grant execute on function public.remove_team_member(text,text,text) to authenticated;

create or replace function public.confirm_opportunity_change(_application_id uuid,_decision text)
returns void language plpgsql security definer set search_path='' as $$
declare a record;o record;
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
 select * into a from public.applications where id=_application_id;
 if not found or a.applicant_user_id<>auth.uid() then raise exception 'Application not found' using errcode='42501'; end if;
 select * into o from public.opportunities where id=a.opportunity_id;
 if _decision not in('accepted','rejected') then raise exception 'Invalid decision'; end if;
 insert into public.opportunity_change_acknowledgements(opportunity_id,application_id,user_id,version,decision,responded_at)
 values(o.id,a.id,auth.uid(),o.version,_decision,now())
 on conflict(application_id,version) do update set decision=excluded.decision,responded_at=excluded.responded_at;
end $$;
revoke all on function public.confirm_opportunity_change(uuid,text) from public,anon;
grant execute on function public.confirm_opportunity_change(uuid,text) to authenticated;
