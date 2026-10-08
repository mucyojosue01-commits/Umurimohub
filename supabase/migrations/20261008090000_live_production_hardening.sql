-- Live production hardening: real opportunities, referrals, messaging, notifications.
-- Canonical Supabase migration. All user-visible mutations remain RLS/RPC-authorized.

drop policy if exists "opportunities business member insert" on public.opportunities;
create policy "opportunities business member insert" on public.opportunities
for insert to authenticated
with check (created_by = auth.uid() and is_business_member(business_id) and coalesce(is_demo,false)=false);

drop policy if exists "opportunities business member update" on public.opportunities;
create policy "opportunities business member update" on public.opportunities
for update to authenticated
using (is_business_member(business_id) and created_by=auth.uid())
with check (is_business_member(business_id) and created_by=auth.uid() and coalesce(is_demo,false)=false);

drop policy if exists "opportunities business member delete" on public.opportunities;
create policy "opportunities business member delete" on public.opportunities
for delete to authenticated
using (is_business_member(business_id) and created_by=auth.uid() and coalesce(is_demo,false)=false);

drop policy if exists "referrals referrer insert" on public.referrals;
create policy "referrals referrer insert" on public.referrals
for insert to authenticated
with check (
 referrer=auth.uid()
 and exists(select 1 from public.opportunities o where o.id=referrals.opportunity_id and o.status='open' and coalesce(o.is_demo,false)=false)
 and exists(select 1 from public.worker_profiles w where w.id=referrals.referee_worker_id and coalesce(w.is_demo,false)=false)
 and not exists(select 1 from public.referrals r where r.opportunity_id=referrals.opportunity_id and r.referee_worker_id=referrals.referee_worker_id and r.referrer=auth.uid())
);

create table if not exists public.conversations (
 id uuid primary key default gen_random_uuid(),
 subject text,
 opportunity_id text references public.opportunities(id) on delete set null,
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 5000),
 created_at timestamptz not null default now()
);
create table if not exists public.message_reads (
 message_id uuid not null references public.messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key(message_id,user_id)
);
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
grant select,insert,update on public.conversations to authenticated;
grant select,insert on public.conversation_members to authenticated;
grant select,insert on public.messages to authenticated;
grant select,insert,delete on public.message_reads to authenticated;

drop policy if exists "conversation members read conversations" on public.conversations;
create policy "conversation members read conversations" on public.conversations for select to authenticated
using(exists(select 1 from public.conversation_members m where m.conversation_id=conversations.id and m.user_id=auth.uid()));
drop policy if exists "conversation creator inserts conversation" on public.conversations;
create policy "conversation creator inserts conversation" on public.conversations for insert to authenticated
with check(created_by=auth.uid());

drop policy if exists "conversation members read members" on public.conversation_members;
create policy "conversation members read members" on public.conversation_members for select to authenticated
using(exists(select 1 from public.conversation_members m where m.conversation_id=conversation_members.conversation_id and m.user_id=auth.uid()));
drop policy if exists "conversation creator adds members" on public.conversation_members;
create policy "conversation creator adds members" on public.conversation_members for insert to authenticated
with check(exists(select 1 from public.conversations c where c.id=conversation_members.conversation_id and c.created_by=auth.uid()) or user_id=auth.uid());

drop policy if exists "conversation members read messages" on public.messages;
create policy "conversation members read messages" on public.messages for select to authenticated
using(exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()));
drop policy if exists "conversation members send messages" on public.messages;
create policy "conversation members send messages" on public.messages for insert to authenticated
with check(sender_id=auth.uid() and exists(select 1 from public.conversation_members m where m.conversation_id=messages.conversation_id and m.user_id=auth.uid()));

drop policy if exists "users read own message receipts" on public.message_reads;
create policy "users read own message receipts" on public.message_reads for select to authenticated using(user_id=auth.uid());
drop policy if exists "users mark own messages read" on public.message_reads;
create policy "users mark own messages read" on public.message_reads for insert to authenticated
with check(user_id=auth.uid() and exists(select 1 from public.conversation_members cm join public.messages m on m.conversation_id=cm.conversation_id where m.id=message_reads.message_id and cm.user_id=auth.uid()));
drop policy if exists "users delete own message receipts" on public.message_reads;
create policy "users delete own message receipts" on public.message_reads for delete to authenticated using(user_id=auth.uid());

create or replace function public.get_or_create_direct_conversation(_other_user uuid,_opportunity_id text default null,_subject text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 if auth.uid() is null or _other_user is null or _other_user=auth.uid() then raise exception 'Invalid conversation participants'; end if;
 select c.id into cid from conversations c
 where c.opportunity_id is not distinct from _opportunity_id
 and exists(select 1 from conversation_members m where m.conversation_id=c.id and m.user_id=auth.uid())
 and exists(select 1 from conversation_members m where m.conversation_id=c.id and m.user_id=_other_user)
 and (select count(*) from conversation_members m where m.conversation_id=c.id)=2
 order by c.created_at desc limit 1;
 if cid is not null then return cid; end if;
 insert into conversations(subject,opportunity_id,created_by) values(_subject,_opportunity_id,auth.uid()) returning id into cid;
 insert into conversation_members values(cid,auth.uid()),(cid,_other_user);
 return cid;
end $$;
revoke all on function public.get_or_create_direct_conversation(uuid,text,text) from public,anon;
grant execute on function public.get_or_create_direct_conversation(uuid,text,text) to authenticated;

create or replace function public.mark_notification_read(_notification_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin update notifications set read=true where id=_notification_id and user_id=auth.uid(); return found; end $$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read() returns integer
language plpgsql security definer set search_path=public as $$
declare n integer; begin update notifications set read=true where user_id=auth.uid() and read=false; get diagnostics n=row_count; return n; end $$;
revoke all on function public.mark_all_notifications_read() from public,anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

do $$ begin
 begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.milestones; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.milestone_events; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.conversations; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.conversation_members; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.message_reads; exception when duplicate_object then null; end;
end $$;

-- Restore identity FKs removed by the legacy SQL test-harness compatibility migration.
do $$ begin
 if not exists(select 1 from pg_constraint where conname='profiles_id_fkey_auth') then alter table public.profiles add constraint profiles_id_fkey_auth foreign key(id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='user_roles_user_id_fkey_auth') then alter table public.user_roles add constraint user_roles_user_id_fkey_auth foreign key(user_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='business_members_user_id_fkey_auth') then alter table public.business_members add constraint business_members_user_id_fkey_auth foreign key(user_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='notifications_user_id_fkey_auth') then alter table public.notifications add constraint notifications_user_id_fkey_auth foreign key(user_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='referrals_referrer_fkey_auth') then alter table public.referrals add constraint referrals_referrer_fkey_auth foreign key(referrer) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='applications_applicant_user_id_fkey_auth') then alter table public.applications add constraint applications_applicant_user_id_fkey_auth foreign key(applicant_user_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='applications_referred_by_fkey_auth') then alter table public.applications add constraint applications_referred_by_fkey_auth foreign key(referred_by) references auth.users(id) on delete set null; end if;
 if not exists(select 1 from pg_constraint where conname='saved_opportunities_user_id_fkey_auth') then alter table public.saved_opportunities add constraint saved_opportunities_user_id_fkey_auth foreign key(user_id) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='connections_requester_fkey_auth') then alter table public.connections add constraint connections_requester_fkey_auth foreign key(requester) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='connections_addressee_fkey_auth') then alter table public.connections add constraint connections_addressee_fkey_auth foreign key(addressee) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='recommendations_from_user_fkey_auth') then alter table public.recommendations add constraint recommendations_from_user_fkey_auth foreign key(from_user) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='recommendations_to_user_fkey_auth') then alter table public.recommendations add constraint recommendations_to_user_fkey_auth foreign key(to_user) references auth.users(id) on delete cascade; end if;
 if not exists(select 1 from pg_constraint where conname='completion_events_actor_fkey_auth') then alter table public.completion_events add constraint completion_events_actor_fkey_auth foreign key(actor) references auth.users(id) on delete set null; end if;
 if not exists(select 1 from pg_constraint where conname='worker_profiles_user_id_fkey_auth') then alter table public.worker_profiles add constraint worker_profiles_user_id_fkey_auth foreign key(user_id) references auth.users(id) on delete set null; end if;
 if not exists(select 1 from pg_constraint where conname='businesses_created_by_fkey_auth') then alter table public.businesses add constraint businesses_created_by_fkey_auth foreign key(created_by) references auth.users(id) on delete set null; end if;
 if not exists(select 1 from pg_constraint where conname='opportunities_created_by_fkey_auth') then alter table public.opportunities add constraint opportunities_created_by_fkey_auth foreign key(created_by) references auth.users(id) on delete set null; end if;
 if not exists(select 1 from pg_constraint where conname='teams_lead_user_id_fkey_auth') then alter table public.teams add constraint teams_lead_user_id_fkey_auth foreign key(lead_user_id) references auth.users(id) on delete set null; end if;
end $$;