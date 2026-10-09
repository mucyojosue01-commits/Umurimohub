-- Fix contract re-acceptance event validation and referral response record ambiguity.
alter table public.contract_events
  drop constraint if exists contract_events_event_type_check;

alter table public.contract_events
  add constraint contract_events_event_type_check
  check (event_type = any (array[
    'proposed'::text,
    'accepted'::text,
    'activated'::text,
    'declined'::text,
    'cancelled'::text,
    'reaccepted'::text,
    'completed'::text
  ]));

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

  if not found then
    raise exception 'Referral not found' using errcode = 'P0002';
  end if;
  if referral_row.referee_user_id <> auth.uid() then
    raise exception 'Only the referred person can respond' using errcode = '42501';
  end if;
  if referral_row.status <> 'pending' then
    raise exception 'This referral has already been handled';
  end if;

  select opp.*
    into opportunity_row
  from public.opportunities as opp
  where opp.id = referral_row.opportunity_id
    and opp.status = 'open'
    and coalesce(opp.is_demo, false) = false;

  if not found then
    raise exception 'Opportunity is no longer available';
  end if;
  if not ('individual' = any(opportunity_row.eligible_actor_types)) then
    raise exception 'This opportunity does not accept individual applicants';
  end if;

  if not _accept then
    update public.referrals
      set status = 'declined'
      where id = referral_row.id;

    insert into public.notifications(user_id, kind, text, link)
    values (
      referral_row.referrer,
      'referral_declined',
      'Your referral was declined: ' || opportunity_row.title,
      '/opportunities/' || opportunity_row.id
    );
    return 'declined';
  end if;

  insert into public.applications(
    opportunity_id, applicant_user_id, kind, applicant_type, note, referred_by
  )
  values (
    opportunity_row.id, auth.uid(), 'individual', 'individual',
    referral_row.note, referral_row.referrer
  )
  on conflict (opportunity_id, applicant_user_id) do update
    set referred_by = excluded.referred_by,
        note = excluded.note,
        status = 'submitted',
        updated_at = now()
  returning id into application_id;

  update public.referrals
    set status = 'accepted'
    where id = referral_row.id;

  insert into public.notifications(user_id, kind, text, link)
  values (
    referral_row.referrer,
    'referral_accepted',
    'Your referral accepted and applied: ' || opportunity_row.title,
    '/opportunities/' || opportunity_row.id
  );

  if opportunity_row.created_by is not null
     and opportunity_row.created_by <> referral_row.referrer then
    insert into public.notifications(user_id, kind, text, link)
    values (
      opportunity_row.created_by,
      'referral_application',
      'A referred applicant has applied: ' || opportunity_row.title,
      '/opportunities/' || opportunity_row.id
    );
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
