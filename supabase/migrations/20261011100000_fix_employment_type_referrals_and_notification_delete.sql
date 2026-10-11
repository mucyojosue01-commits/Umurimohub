-- Repair the employment opportunity type invariant, referral acceptance upsert,
-- and notification deletion permissions.
alter table public.opportunities alter column type set default 'Job';

create or replace function public.ensure_opportunity_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.type is null or btrim(new.type) = '' then
    new.type := 'Job';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_opportunity_type_before_write on public.opportunities;
create trigger ensure_opportunity_type_before_write
before insert or update of type on public.opportunities
for each row execute function public.ensure_opportunity_type();

create or replace function public.respond_referral(_referral_id uuid, _accept boolean)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  referral_row record;
  opportunity_row record;
  application_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select ref.*, worker.user_id as referee_user_id
    into referral_row
  from public.referrals as ref
  join public.worker_profiles as worker on worker.id = ref.referee_worker_id
  where ref.id = _referral_id
  for update of ref;

  if not found then raise exception 'Referral not found' using errcode = 'P0002'; end if;
  if referral_row.referee_user_id <> auth.uid() then
    raise exception 'Only the referred person can respond' using errcode = '42501';
  end if;
  if referral_row.status <> 'pending' then raise exception 'This referral has already been handled'; end if;

  select opp.* into opportunity_row
  from public.opportunities as opp
  where opp.id = referral_row.opportunity_id
    and opp.status = 'open'
    and coalesce(opp.is_demo, false) = false;

  if not found then raise exception 'Opportunity is no longer available'; end if;
  if not ('individual' = any(opportunity_row.eligible_actor_types)) then
    raise exception 'This opportunity does not accept individual applicants';
  end if;

  if not _accept then
    update public.referrals set status = 'declined' where id = referral_row.id;
    insert into public.notifications(user_id, kind, text, link)
    values (referral_row.referrer, 'referral_declined',
      'Your referral was declined: ' || opportunity_row.title,
      '/opportunities/' || opportunity_row.id);
    return 'declined';
  end if;

  -- Serialize acceptances for this applicant/opportunity, then update an existing
  -- application or insert a new one without relying on a missing unique constraint.
  perform pg_advisory_xact_lock(hashtext(opportunity_row.id || ':' || auth.uid()::text));
  select id into application_id
  from public.applications
  where opportunity_id = opportunity_row.id and applicant_user_id = auth.uid()
  order by created_at desc
  limit 1
  for update;

  if application_id is null then
    insert into public.applications(
      opportunity_id, applicant_user_id, kind, applicant_type, note, referred_by
    ) values (
      opportunity_row.id, auth.uid(), 'individual', 'individual',
      referral_row.note, referral_row.referrer
    ) returning id into application_id;
  else
    update public.applications
      set referred_by = referral_row.referrer,
          note = referral_row.note,
          status = 'submitted',
          updated_at = now()
      where id = application_id;
  end if;

  update public.referrals set status = 'accepted' where id = referral_row.id;
  insert into public.notifications(user_id, kind, text, link)
  values (referral_row.referrer, 'referral_accepted',
    'Your referral accepted and applied: ' || opportunity_row.title,
    '/opportunities/' || opportunity_row.id);

  if opportunity_row.created_by is not null and opportunity_row.created_by <> referral_row.referrer then
    insert into public.notifications(user_id, kind, text, link)
    values (opportunity_row.created_by, 'referral_application',
      'A referred applicant has applied: ' || opportunity_row.title,
      '/opportunities/' || opportunity_row.id);
  end if;

  if opportunity_row.business_id is not null then
    insert into public.notifications(user_id, kind, text, link)
    select bm.user_id, 'referral_application',
      'A referred applicant has applied: ' || opportunity_row.title,
      '/opportunities/' || opportunity_row.id
    from public.business_members as bm
    where bm.business_id = opportunity_row.business_id
      and bm.user_id <> coalesce(opportunity_row.created_by, auth.uid());
  end if;

  return application_id::text;
end;
$function$;

drop policy if exists "notifications owner delete" on public.notifications;
create policy "notifications owner delete" on public.notifications
for delete to authenticated using (user_id = auth.uid());

grant execute on function public.respond_referral(uuid, boolean) to authenticated;
