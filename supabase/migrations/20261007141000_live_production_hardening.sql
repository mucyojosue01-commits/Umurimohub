-- Live production hardening: opportunities, referrals, notifications, messaging, realtime.
drop policy if exists "opportunities business member insert" on public.opportunities;
drop policy if exists "opportunities business member update" on public.opportunities;
drop policy if exists "opportunities business member delete" on public.opportunities;
create policy "opportunities business member insert" on public.opportunities for insert to authenticated
with check (created_by = auth.uid() and is_business_member(business_id) and coalesce(is_demo,false)=false);
create policy "opportunities business member update" on public.opportunities for update to authenticated
using (is_business_member(business_id) and created_by=auth.uid())
with check (is_business_member(business_id) and created_by=auth.uid() and coalesce(is_demo,false)=false);
create policy "opportunities business member delete" on public.opportunities for delete to authenticated
using (is_business_member(business_id) and created_by=auth.uid() and coalesce(is_demo,false)=false);

drop policy if exists "referrals referrer insert" on public.referrals;
create policy "referrals referrer insert" on public.referrals for insert to authenticated
with check (
  referrer=auth.uid()
  and exists (select 1 from public.opportunities o where o.id=referrals.opportunity_id and o.status='open' and coalesce(o.is_demo,false)=false)
  and exists (select 1 from public.worker_profiles w where w.id=referrals.referee_worker_id and coalesce(w.is_demo,false)=false and w.visibility='public')
  and not exists (select 1 from public.referrals r where r.opportunity_id=referrals.opportunity_id and r.referee_worker_id=referrals.referee_worker_id and r.referrer=auth.uid())
);
create unique index if not exists referrals_unique_referral on public.referrals(opportunity_id,referee_worker_id,referrer);

drop policy if exists "own notifications mark read" on public.notifications;
create or replace function public.mark_notification_read(_notification_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin update public.notifications set read=true where id=_notification_id and user_id=auth.uid(); return found; end $$;
create or replace function public.mark_all_notifications_read() returns integer language plpgsql security definer set search_path=public as $$
declare n integer; begin update public.notifications set read=true where user_id=auth.uid() and read=false; get diagnostics n=row_count; return n; end $$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
revoke all on function public.mark_all_notifications_read() from public,anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  subject text,
  opportunity_id text references public.opportunities(id) on delete set null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  body text not null check(char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key(message_id,user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id,conversation_id);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
create index if not exists message_reads_user_idx on public.message_reads(user_id,read_at);
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
grant select,insert,update,delete on public.conversations to authenticated;
grant select,insert,update,delete on public.conversation_members to authenticated;
grant select,insert on public.messages to authenticated;
grant select,insert,delete on public.message_reads to authenticated;
drop policy if exists "conversation members read conversations" on public.conversations;
drop policy if exists "conversation creator inserts conversation" on public.conversations;
drop policy if exists "conversation creator updates conversation" on public.conversations;
create policy "conversation members read conversations" on public.conversations for select to authenticated
using(exists(select 1 from public.conversation_members m where m.conversation_id=conversations.id and m.user_id=auth.uid()));
create policy "conversation creator inserts conversation" on public.conversations for insert to authenticated
with check(created_by=auth.uid());
create policy "conversation creator updates conversation" on public.conversations for update to authenticated
using(created_by=auth.uid()) with check(created_by=auth.uid());
drop policy if exists "conversation members read members" on public.conversation_members;
drop policy if exists "conversation creator adds members" on public.conversation_members;
create policy "conversation members read members" on public.conversation_members for select to authenticated
using(exists(select 1 from public.conversation_members me where me.conversation_id=conversation_members.conversation_id and me.user_id=auth.uid()));
create policy "conversation creator adds members" on public.conversation_members for insert to authenticated
with check(exists(select 1 from public.conversations c where c.id=conversation_members.conversation_id and c.created_by=auth.uid()) or user_id=auth.uid());
drop policy if exists "conversation members read messages" on public.messages;
drop policy if exists "conversation members send messages" on public.messages;
create policy "conversation members read messages" on public.messages for select to authenticated
using(exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()));
create policy "conversation members send messages" on public.messages for insert to authenticated
with check(sender_id=auth.uid() and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()));
drop policy if exists "users read own message receipts" on public.message_reads;
drop policy if exists "users mark own messages read" on public.message_reads;
drop policy if exists "users delete own message receipts" on public.message_reads;
create policy "users read own message receipts" on public.message_reads for select to authenticated using(user_id=auth.uid());
create policy "users mark own messages read" on public.message_reads for insert to authenticated
with check(user_id=auth.uid() and exists(select 1 from public.conversation_members cm join public.messages m on m.conversation_id=cm.conversation_id where m.id=message_reads.message_id and cm.user_id=auth.uid()));
create policy "users delete own message receipts" on public.message_reads for delete to authenticated using(user_id=auth.uid());
create or replace function public.get_or_create_direct_conversation(_other_user uuid,_opportunity_id text default null,_subject text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 if auth.uid() is null or _other_user is null or _other_user=auth.uid() then raise exception 'Invalid conversation participants'; end if;
 select c.id into cid from public.conversations c
 where _opportunity_id is not distinct from c.opportunity_id
 and exists(select 1 from public.conversation_members a where a.conversation_id=c.id and a.user_id=auth.uid())
 and exists(select 1 from public.conversation_members b where b.conversation_id=c.id and b.user_id=_other_user)
 and (select count(*) from public.conversation_members x where x.conversation_id=c.id)=2
 order by c.created_at desc limit 1;
 if cid is not null then return cid; end if;
 insert into public.conversations(subject,opportunity_id,created_by) values(_subject,_opportunity_id,auth.uid()) returning id into cid;
 insert into public.conversation_members(conversation_id,user_id) values(cid,auth.uid()),(cid,_other_user);
 return cid;
end $$;
revoke all on function public.get_or_create_direct_conversation(uuid,text,text) from public,anon;
grant execute on function public.get_or_create_direct_conversation(uuid,text,text) to authenticated;
create or replace function public.notify_referral_created() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; opportunity_title text;
begin
 select w.user_id into recipient from public.worker_profiles w where w.id=new.referee_worker_id;
 select o.title into opportunity_title from public.opportunities o where o.id=new.opportunity_id;
 if recipient is not null and recipient<>new.referrer then
   insert into public.notifications(user_id,kind,text,link) values(recipient,'referral','Someone referred you for: '||coalesce(opportunity_title,'an opportunity'),'/opportunities/'||new.opportunity_id);
 end if;
 insert into public.notifications(user_id,kind,text,link)
 select bm.user_id,'referral','A worker referral was submitted for: '||coalesce(opportunity_title,'an opportunity'),'/opportunities/'||new.opportunity_id
 from public.business_members bm join public.opportunities o on o.business_id=bm.business_id and o.id=new.opportunity_id
 where bm.user_id<>new.referrer;
 return new;
end $$;
drop trigger if exists referrals_notify on public.referrals;
create trigger referrals_notify after insert on public.referrals for each row execute function public.notify_referral_created();\nrevoke all on function public.notify_referral_created() from public,anon,authenticated;
create or replace function public.notify_message_created() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.notifications(user_id,kind,text,link)
 select cm.user_id,'message','New message from '||coalesce((select display_name from public.profiles p where p.id=new.sender_id),'a member'),'/messages?conversation='||new.conversation_id::text
 from public.conversation_members cm where cm.conversation_id=new.conversation_id and cm.user_id<>new.sender_id;
 return new;
end $$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages for each row execute function public.notify_message_created();\nrevoke all on function public.notify_message_created() from public,anon,authenticated;
do $$ begin
 begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.milestones; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.milestone_events; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.conversations; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.conversation_members; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.message_reads; exception when duplicate_object then null; end;
end $$;

-- Restore identity integrity after the legacy test-harness compatibility migration.
do $$
begin
 if not exists(select 1 from pg_constraint where conname='profiles_id_auth_users_fkey') then alter table public.profiles add constraint profiles_id_auth_users_fkey foreign key(id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='user_roles_user_id_auth_users_fkey') then alter table public.user_roles add constraint user_roles_user_id_auth_users_fkey foreign key(user_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='business_members_user_id_auth_users_fkey') then alter table public.business_members add constraint business_members_user_id_auth_users_fkey foreign key(user_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='worker_profiles_user_id_auth_users_fkey') then alter table public.worker_profiles add constraint worker_profiles_user_id_auth_users_fkey foreign key(user_id) references auth.users(id) on delete set null; end if;
 if not exists(select 1 from pg_constraint where conname='teams_lead_user_id_auth_users_fkey') then alter table public.teams add constraint teams_lead_user_id_auth_users_fkey foreign key(lead_user_id) references auth.users(id) on delete set null; end if;
 if not exists(select 1 from pg_constraint where conname='applications_applicant_user_id_auth_users_fkey') then alter table public.applications add constraint applications_applicant_user_id_auth_users_fkey foreign key(applicant_user_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='applications_referred_by_auth_users_fkey') then alter table public.applications add constraint applications_referred_by_auth_users_fkey foreign key(referred_by) references auth.users(id) on delete set null; end if;
 if not exists(select 1 from pg_constraint where conname='referrals_referrer_auth_users_fkey') then alter table public.referrals add constraint referrals_referrer_auth_users_fkey foreign key(referrer) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='notifications_user_id_auth_users_fkey') then alter table public.notifications add constraint notifications_user_id_auth_users_fkey foreign key(user_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='conversations_created_by_auth_users_fkey') then alter table public.conversations add constraint conversations_created_by_auth_users_fkey foreign key(created_by) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='conversation_members_user_id_auth_users_fkey') then alter table public.conversation_members add constraint conversation_members_user_id_auth_users_fkey foreign key(user_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='messages_sender_id_auth_users_fkey') then alter table public.messages add constraint messages_sender_id_auth_users_fkey foreign key(sender_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='message_reads_user_id_auth_users_fkey') then alter table public.message_reads add constraint message_reads_user_id_auth_users_fkey foreign key(user_id) references auth.users(id) on delete cascade; end if;
end $$;
