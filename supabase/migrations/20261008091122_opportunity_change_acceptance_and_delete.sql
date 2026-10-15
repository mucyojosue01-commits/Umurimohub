alter table public.opportunities add column if not exists terms_version integer not null default 1;
alter table public.applications add column if not exists accepted_terms_version integer not null default 1;
create index if not exists applications_terms_version_idx on public.applications(opportunity_id, accepted_terms_version);

drop policy if exists "opportunities creator delete" on public.opportunities;
create policy "opportunities creator delete" on public.opportunities
for delete to authenticated
using (created_by = auth.uid() or (business_id is not null and public.is_business_member(business_id, array['owner','admin'])));

create or replace function public.notify_opportunity_terms_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare new_version integer;
begin
  new_version := old.terms_version + 1;
  update public.opportunities set terms_version = new_version where id = new.id;

  insert into public.notifications(user_id, kind, text, link)
  select a.applicant_user_id,
         'opportunity_terms_changed',
         'Opportunity updated: ' || new.title || '. Review and accept the new terms.',
         '/opportunities/' || new.id
  from public.applications a
  where a.opportunity_id = new.id
    and a.status not in ('withdrawn','rejected')
    and a.accepted_terms_version < new_version;

  return new;
end;
$$;

drop trigger if exists opportunity_terms_changed on public.opportunities;
create trigger opportunity_terms_changed
after update of title,summary,pay_rwf,pay_unit,district,type,mode,duration,deadline,skills,responsibilities,requirements,team_allowed,team_size,eligible_actor_types
on public.opportunities
for each row
when (old.* is distinct from new.*)
execute function public.notify_opportunity_terms_change();

create or replace function public.respond_to_opportunity_change(_application_id uuid, _accept boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare a record; o record; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into a from public.applications where id=_application_id and applicant_user_id=uid for update;
  if not found then raise exception 'Application not found' using errcode='P0002'; end if;
  select * into o from public.opportunities where id=a.opportunity_id;
  if not found then raise exception 'Opportunity not found' using errcode='P0002'; end if;
  if a.status in ('withdrawn','rejected') then raise exception 'This application is no longer active'; end if;
  if a.accepted_terms_version >= o.terms_version then return true; end if;

  if _accept then
    update public.applications set accepted_terms_version=o.terms_version, updated_at=now() where id=a.id;
    insert into public.notifications(user_id,kind,text,link)
    values(uid,'opportunity_terms_accepted','You accepted the updated terms for ' || o.title,'/dashboard');
  else
    update public.applications set status='withdrawn', accepted_terms_version=o.terms_version, updated_at=now() where id=a.id;
    insert into public.notifications(user_id,kind,text,link)
    values(uid,'opportunity_terms_declined','You declined the updated terms for ' || o.title || '. Your application was withdrawn.','/dashboard');
  end if;
  return true;
end;
$$;

revoke all on function public.respond_to_opportunity_change(uuid,boolean) from public,anon;
grant execute on function public.respond_to_opportunity_change(uuid,boolean) to authenticated;