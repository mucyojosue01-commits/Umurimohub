-- Automatically close expired opportunities, notify the poster, and enforce team-size limits.
create or replace function public.close_expired_opportunities()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare closed_count integer;
begin
  update public.opportunities
     set status = 'closed'
   where status = 'open'
     and deadline < current_date
     and coalesce(is_demo, false) = false;
  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;

create or replace function public.notify_opportunity_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare status_label text;
begin
  if old.status is distinct from new.status and new.status in ('closed', 'deleted') then
    status_label := case when new.status = 'closed' then 'recently closed' else 'ended' end;
    insert into public.notifications(user_id, kind, text, link)
    select a.applicant_user_id,
      case when new.status = 'closed' then 'opportunity_closed' else 'opportunity_ended' end,
      'Opportunity ' || status_label || ': ' || new.title || '. This opportunity is no longer accepting applications.',
      '/opportunities/' || new.id
    from public.applications a
    where a.opportunity_id = new.id and a.status not in ('withdrawn', 'rejected');

    if new.status = 'closed' and new.created_by is not null then
      insert into public.notifications(user_id, kind, text, link)
      values(new.created_by, 'opportunity_deadline_closed',
        'Your opportunity "' || new.title || '" was automatically closed because its deadline passed. You can edit it to extend the deadline or end it.',
        '/opportunities/' || new.id || '/edit');
    end if;
    if new.status = 'closed' and new.business_id is not null then
      insert into public.notifications(user_id, kind, text, link)
      select bm.user_id, 'opportunity_deadline_closed',
        'Your business opportunity "' || new.title || '" was automatically closed because its deadline passed. You can edit it to extend the deadline or end it.',
        '/opportunities/' || new.id || '/edit'
      from public.business_members bm
      where bm.business_id = new.business_id
        and bm.user_id is distinct from new.created_by;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists opportunity_status_changed on public.opportunities;
create trigger opportunity_status_changed
after update of status on public.opportunities
for each row execute function public.notify_opportunity_status_change();

create or replace function public.enforce_team_opportunity_size()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare max_size integer; actual_size integer;
begin
  if lower(coalesce(new.kind, '')) = 'team' or lower(coalesce(new.applicant_type, '')) = 'team' then
    if new.applicant_team_id is null then
      raise exception 'Select a team before applying.' using errcode = '23514';
    end if;
    select o.team_size into max_size
      from public.opportunities o
     where o.id = new.opportunity_id and o.status = 'open'
       and o.deadline >= current_date;
    if not found then
      raise exception 'This opportunity is no longer accepting applications.' using errcode = '23514';
    end if;
    select count(*)::integer into actual_size
      from public.team_members tm
     where tm.team_id = new.applicant_team_id and tm.status = 'active';
    if max_size is not null and actual_size > max_size then
      raise exception 'This team has % active members; the opportunity allows at most %.', actual_size, max_size using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_team_size_check on public.applications;
create trigger applications_team_size_check
before insert or update of opportunity_id, applicant_team_id, kind, applicant_type
on public.applications
for each row execute function public.enforce_team_opportunity_size();

-- Keep the application path closed even if the hourly scheduled job has not run yet.
create or replace function public.reject_expired_opportunity_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.opportunities o
    where o.id = new.opportunity_id and o.status = 'open' and o.deadline < current_date
  ) then
    update public.opportunities set status = 'closed' where id = new.opportunity_id and status = 'open';
    raise exception 'The application deadline has passed. This opportunity has been closed.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists applications_reject_expired_opportunity on public.applications;
create trigger applications_reject_expired_opportunity
before insert on public.applications
for each row execute function public.reject_expired_opportunity_application();

-- Schedule expiry checks hourly where Supabase pg_cron is enabled.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      execute 'select cron.unschedule(jobid) from cron.job where jobname = ''close-expired-opportunities-hourly''';
    exception when undefined_table or undefined_function then null;
    end;
    begin
      execute 'select cron.schedule(''close-expired-opportunities-hourly'', ''0 * * * *'', ''select public.close_expired_opportunities();'')';
    exception when undefined_function or undefined_table then null;
    end;
  end if;
end;
$$;

-- Make referral notifications tell the referrer who responded, not just the opportunity title.
create or replace function public.respond_referral(_referral_id uuid, _accept boolean)
returns text
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  referral_row record;
  opportunity_row record;
  application_id uuid;
  referee_name text;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select ref.*, worker.user_id as referee_user_id, worker.name as referee_name
    into referral_row
    from public.referrals ref
    join public.worker_profiles worker on worker.id = ref.referee_worker_id
   where ref.id = _referral_id for update of ref;
  if not found then raise exception 'Referral not found' using errcode = 'P0002'; end if;
  if referral_row.referee_user_id <> auth.uid() then raise exception 'Only the referred person can respond' using errcode = '42501'; end if;
  if referral_row.status <> 'pending' then raise exception 'This referral has already been handled'; end if;
  referee_name := coalesce(nullif(trim(referral_row.referee_name), ''), 'The person you referred');
  select opp.* into opportunity_row from public.opportunities opp
   where opp.id = referral_row.opportunity_id and opp.status = 'open' and coalesce(opp.is_demo, false) = false;
  if not found then raise exception 'Opportunity is no longer available'; end if;
  if not ('individual' = any(opportunity_row.eligible_actor_types)) then raise exception 'This opportunity does not accept individual applicants'; end if;

  if not _accept then
    update public.referrals set status = 'declined' where id = referral_row.id;
    insert into public.notifications(user_id,kind,text,link)
    values(referral_row.referrer,'referral_declined',
      referee_name || ' you referred for opportunity "' || opportunity_row.title || '" has denied it.',
      '/opportunities/' || opportunity_row.id);
    return 'declined';
  end if;

  insert into public.applications(opportunity_id,applicant_user_id,kind,applicant_type,note,referred_by)
  values(opportunity_row.id,auth.uid(),'individual','individual',referral_row.note,referral_row.referrer)
  on conflict (opportunity_id,applicant_user_id) do update
    set referred_by=excluded.referred_by,note=excluded.note,status='submitted',updated_at=now()
  returning id into application_id;
  update public.referrals set status = 'accepted' where id = referral_row.id;
  insert into public.notifications(user_id,kind,text,link)
  values(referral_row.referrer,'referral_accepted',
    referee_name || ' you referred for opportunity "' || opportunity_row.title || '" has accepted and applied.',
    '/opportunities/' || opportunity_row.id);

  if opportunity_row.created_by is not null and opportunity_row.created_by <> referral_row.referrer then
    insert into public.notifications(user_id,kind,text,link)
    values(opportunity_row.created_by,'referral_application','A referred applicant has applied: ' || opportunity_row.title,'/opportunities/' || opportunity_row.id);
  end if;
  if opportunity_row.business_id is not null then
    insert into public.notifications(user_id,kind,text,link)
    select bm.user_id,'referral_application','A referred applicant has applied: ' || opportunity_row.title,'/opportunities/' || opportunity_row.id
      from public.business_members bm
     where bm.business_id=opportunity_row.business_id and bm.user_id <> coalesce(opportunity_row.created_by,auth.uid());
  end if;
  return application_id::text;
end;
$$;
revoke all on function public.respond_referral(uuid,boolean) from public, anon;
grant execute on function public.respond_referral(uuid,boolean) to authenticated;
