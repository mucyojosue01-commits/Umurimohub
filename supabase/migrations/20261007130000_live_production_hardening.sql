-- Live production hardening: real onboarding, opportunity ownership, messaging and notification read state.
-- The migration is intentionally idempotent so environments that already received the equivalent
-- changes can reconcile from Git without destructive operations.

-- Restore auth identity foreign keys that were temporarily removed for a legacy SQL harness.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_id_fkey') then
    alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='user_roles_user_id_fkey') then
    alter table public.user_roles add constraint user_roles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='worker_profiles_user_id_fkey') then
    alter table public.worker_profiles add constraint worker_profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='businesses_created_by_fkey') then
    alter table public.businesses add constraint businesses_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='business_members_user_id_fkey') then
    alter table public.business_members add constraint business_members_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='teams_lead_user_id_fkey') then
    alter table public.teams add constraint teams_lead_user_id_fkey foreign key (lead_user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='applications_applicant_user_id_fkey') then
    alter table public.applications add constraint applications_applicant_user_id_fkey foreign key (applicant_user_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='applications_referred_by_fkey') then
    alter table public.applications add constraint applications_referred_by_fkey foreign key (referred_by) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='connections_requester_fkey') then
    alter table public.connections add constraint connections_requester_fkey foreign key (requester) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='connections_addressee_fkey') then
    alter table public.connections add constraint connections_addressee_fkey foreign key (addressee) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='referrals_referrer_fkey') then
    alter table public.referrals add constraint referrals_referrer_fkey foreign key (referrer) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='recommendations_from_user_fkey') then
    alter table public.recommendations add constraint recommendations_from_user_fkey foreign key (from_user) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='recommendations_to_user_fkey') then
    alter table public.recommendations add constraint recommendations_to_user_fkey foreign key (to_user) references auth.users(id) on delete cascade;
  end if;
end $$;

drop policy if exists "opportunities business member insert" on public.opportunities;
create policy "opportunities business member insert"
on public.opportunities for insert to authenticated
with check (
  created_by = auth.uid()
  and is_business_member(business_id)
  and coalesce(is_demo,false)=false
);

drop policy if exists "opportunities business member update" on public.opportunities;
create policy "opportunities business member update"
on public.opportunities for update to authenticated
using (is_business_member(business_id) and created_by=auth.uid())
with check (is_business_member(business_id) and created_by=auth.uid() and coalesce(is_demo,false)=false);

drop policy if exists "opportunities business member delete" on public.opportunities;
create policy "opportunities business member delete"
on public.opportunities for delete to authenticated
using (is_business_member(business_id) and created_by=auth.uid() and coalesce(is_demo,false)=false);

create or replace function public.complete_onboarding(
  _display_name text,_phone text,_district text,_roles public.app_role[],
  _title text default '',_sector text default 'Construction',_rate_rwf integer default 0,
  _skills text[] default '{}',_business_name text default null,_team_name text default null)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); wid text; bid text; tid text; role public.app_role; initials text; s text;
begin
  if uid is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  if btrim(coalesce(_display_name,''))='' or char_length(btrim(_display_name))>80 then raise exception 'Enter a valid name'; end if;
  if btrim(coalesce(_district,''))='' then raise exception 'Choose your district'; end if;
  if _rate_rwf<0 or _rate_rwf>10000000 then raise exception 'Invalid rate'; end if;

  insert into profiles(id,display_name,phone,district) values(uid,btrim(_display_name),nullif(btrim(_phone),''),btrim(_district))
  on conflict(id) do update set display_name=excluded.display_name,phone=excluded.phone,district=excluded.district,updated_at=now();

  foreach role in array _roles loop
    if role::text in ('admin','institution') then raise exception 'That role cannot be self-assigned'; end if;
    insert into user_roles(user_id,role) values(uid,role) on conflict(user_id,role) do nothing;
  end loop;

  if 'worker'=any(_roles) or 'team_lead'=any(_roles) then
    initials:=upper(left(regexp_replace(btrim(_display_name),'[^A-Za-z0-9 ]','','g'),1)||coalesce(left(split_part(btrim(_display_name),' ',2),1),''));
    select id into wid from worker_profiles where user_id=uid limit 1;
    if wid is null then
      insert into worker_profiles(name,title,district,sector,rate_rwf,initials,user_id,is_demo)
      values(btrim(_display_name),btrim(coalesce(_title,'')),btrim(_district),btrim(coalesce(_sector,'Construction')),_rate_rwf,initials,uid,false) returning id into wid;
    else
      update worker_profiles set name=btrim(_display_name),title=btrim(coalesce(_title,'')),district=btrim(_district),sector=btrim(coalesce(_sector,'Construction')),rate_rwf=_rate_rwf,initials=initials,is_demo=false where id=wid;
    end if;
    foreach s in array coalesce(_skills,'{}') loop
      if char_length(btrim(s)) between 1 and 60 then
        insert into worker_skills(worker_id,name) values(wid,btrim(s)) on conflict(worker_id,name) do nothing;
      end if;
    end loop;
  end if;

  if 'business'=any(_roles) then
    if btrim(coalesce(_business_name,''))='' then raise exception 'Enter your business name'; end if;
    select id into bid from businesses where created_by=uid and coalesce(is_demo,false)=false order by created_at limit 1;
    if bid is null then
      insert into businesses(name,sector,district,created_by,is_demo) values(btrim(_business_name),btrim(coalesce(_sector,'Construction')),btrim(_district),uid,false) returning id into bid;
      insert into business_members(business_id,user_id,role) values(bid,uid,'owner');
    end if;
  end if;

  if 'team_lead'=any(_roles) then
    if wid is null then raise exception 'Team leader needs a worker profile'; end if;
    if btrim(coalesce(_team_name,''))='' then raise exception 'Enter your team name'; end if;
    select id into tid from teams where lead_user_id=uid and coalesce(is_demo,false)=false order by created_at limit 1;
    if tid is null then
      insert into teams(name,lead_user_id,lead_worker_id,sector,areas,is_demo)
      values(btrim(_team_name),uid,wid,btrim(coalesce(_sector,'Construction')),array[_district],false) returning id into tid;
      insert into team_members(team_id,worker_id,role,status) values(tid,wid,'lead','active');
    end if;
  end if;
  return jsonb_build_object('user_id',uid,'worker_id',wid,'business_id',bid,'team_id',tid);
end;
$$;
revoke all on function public.complete_onboarding(text,text,text,public.app_role[],text,text,integer,text[],text,text) from public,anon;
grant execute on function public.complete_onboarding(text,text,text,public.app_role[],text,text,integer,text[],text,text) to authenticated;

create table if not exists public.conversations(
  id uuid primary key default gen_random_uuid(), subject text, opportunity_id text references public.opportunities(id) on delete set null,
  created_by uuid not null, created_at timestamptz not null default now());
create table if not exists public.conversation_members(
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null, joined_at timestamptz not null default now(), primary key(conversation_id,user_id));
create table if not exists public.messages(
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null, body text not null check(char_length(trim(body)) between 1 and 5000), created_at timestamptz not null default now());
create table if not exists public.message_reads(
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null, read_at timestamptz not null default now(), primary key(message_id,user_id));

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
grant select,insert,update,delete on public.conversations to authenticated;
grant select,insert,update,delete on public.conversation_members to authenticated;
grant select,insert on public.messages to authenticated;
grant select,insert,delete on public.message_reads to authenticated;

drop policy if exists "conversation members read conversations" on public.conversations;
create policy "conversation members read conversations" on public.conversations for select to authenticated
using(exists(select 1 from public.conversation_members m where m.conversation_id=id and m.user_id=auth.uid()));
drop policy if exists "conversation creator inserts conversation" on public.conversations;
create policy "conversation creator inserts conversation" on public.conversations for insert to authenticated
with check(created_by=auth.uid());
drop policy if exists "conversation members read members" on public.conversation_members;
create policy "conversation members read members" on public.conversation_members for select to authenticated
using(exists(select 1 from public.conversation_members me where me.conversation_id=conversation_id and me.user_id=auth.uid()));
drop policy if exists "conversation creator adds members" on public.conversation_members;
create policy "conversation creator adds members" on public.conversation_members for insert to authenticated
with check(exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=auth.uid()) or user_id=auth.uid());
drop policy if exists "conversation members read messages" on public.messages;
create policy "conversation members read messages" on public.messages for select to authenticated
using(exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));
drop policy if exists "conversation members send messages" on public.messages;
create policy "conversation members send messages" on public.messages for insert to authenticated
with check(sender_id=auth.uid() and exists(select 1 from public.conversation_members m where m.conversation_id=conversation_id and m.user_id=auth.uid()));
drop policy if exists "users read own message receipts" on public.message_reads;
create policy "users read own message receipts" on public.message_reads for select to authenticated using(user_id=auth.uid());
drop policy if exists "users mark own messages read" on public.message_reads;
create policy "users mark own messages read" on public.message_reads for insert to authenticated
with check(user_id=auth.uid() and exists(select 1 from public.conversation_members cm join public.messages m on m.conversation_id=cm.conversation_id where m.id=message_id and cm.user_id=auth.uid()));
drop policy if exists "users delete own message receipts" on public.message_reads;
create policy "users delete own message receipts" on public.message_reads for delete to authenticated using(user_id=auth.uid());

create or replace function public.get_or_create_direct_conversation(_other_user uuid,_opportunity_id text default null,_subject text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if auth.uid() is null or _other_user is null or _other_user=auth.uid() then raise exception 'Invalid conversation participants'; end if;
  select c.id into cid from conversations c
  where _opportunity_id is not distinct from c.opportunity_id
    and exists(select 1 from conversation_members a where a.conversation_id=c.id and a.user_id=auth.uid())
    and exists(select 1 from conversation_members b where b.conversation_id=c.id and b.user_id=_other_user)
    and (select count(*) from conversation_members x where x.conversation_id=c.id)=2
  order by c.created_at desc limit 1;
  if cid is not null then return cid; end if;
  insert into conversations(subject,opportunity_id,created_by) values(_subject,_opportunity_id,auth.uid()) returning id into cid;
  insert into conversation_members(conversation_id,user_id) values(cid,auth.uid()),(cid,_other_user);
  return cid;
end;
$$;
revoke all on function public.get_or_create_direct_conversation(uuid,text,text) from public,anon;
grant execute on function public.get_or_create_direct_conversation(uuid,text,text) to authenticated;

create or replace function public.mark_notification_read(_notification_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin update notifications set read=true where id=_notification_id and user_id=auth.uid(); return found; end $$;
create or replace function public.mark_all_notifications_read() returns integer language plpgsql security definer set search_path=public as $$
declare n integer; begin update notifications set read=true where user_id=auth.uid() and read=false; get diagnostics n=row_count; return n; end $$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
revoke all on function public.mark_all_notifications_read() from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.milestones; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.milestone_events; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.conversations; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.conversation_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.message_reads; exception when duplicate_object then null; end;
end $$;
