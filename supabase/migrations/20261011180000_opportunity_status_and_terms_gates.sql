-- Notify active applicants when an opportunity closes, and prevent stale-term applications from advancing.
create or replace function public.notify_opportunity_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status = 'closed' then
    insert into public.notifications(user_id, kind, text, link)
    select distinct a.applicant_user_id, 'opportunity_closed',
      'Recently closed: ' || new.title || '. This opportunity is no longer accepting applications.',
      '/opportunities/' || new.id
    from public.applications a
    where a.opportunity_id = new.id and a.status not in ('withdrawn','rejected');

    insert into public.notifications(user_id, kind, text, link)
    select distinct r.referrer, 'referral_opportunity_closed',
      'Recently closed: ' || new.title || '. Your referral is no longer active.',
      '/opportunities'
    from public.referrals r
    where r.opportunity_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists opportunity_closed_notifications on public.opportunities;
create trigger opportunity_closed_notifications
after update of status on public.opportunities
for each row execute function public.notify_opportunity_closed();

create or replace function public.guard_application_terms_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare current_terms integer;
begin
  if new.status is distinct from old.status and new.status in ('viewed','shortlisted','accepted') then
    select terms_version into current_terms from public.opportunities where id = new.opportunity_id;
    if current_terms is not null and coalesce(old.accepted_terms_version, 1) < current_terms then
      raise exception 'Applicant must accept the latest opportunity terms before the application can advance';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists application_requires_current_terms on public.applications;
create trigger application_requires_current_terms
before update of status on public.applications
for each row execute function public.guard_application_terms_acceptance();
