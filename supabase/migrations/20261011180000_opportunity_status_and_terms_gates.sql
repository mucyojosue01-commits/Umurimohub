-- Notify active applicants when an opportunity closes, and prevent stale-term applications from advancing.
create or replace function public.notify_opportunity_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status in ('closed','ended') then
    insert into public.notifications(user_id, kind, text, link)
    select distinct a.applicant_user_id, 'opportunity_closed',
      case when new.status = 'closed' then 'Recently closed: ' || new.title || '. This opportunity is no longer accepting applications.' else 'Ended: ' || new.title || '. This opportunity has been removed from listings.' end,
      '/opportunities/' || new.id
    from public.applications a
    where a.opportunity_id = new.id and a.status not in ('withdrawn','rejected');

    insert into public.notifications(user_id, kind, text, link)
    select distinct r.referrer, 'referral_opportunity_closed',
      case when new.status = 'closed' then 'Recently closed: ' || new.title || '. Your referral is no longer active.' else 'Ended: ' || new.title || '. Your referral is no longer active.' end,
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

-- Keep a readable audit of the exact opportunity fields changed between terms versions.
create table if not exists public.opportunity_change_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null references public.opportunities(id) on delete cascade,
  terms_version integer not null,
  changed_fields jsonb not null default '{}'::jsonb,
  changed_at timestamptz not null default now()
);
create index if not exists opportunity_change_history_recent_idx
  on public.opportunity_change_history(opportunity_id, terms_version desc);
alter table public.opportunity_change_history enable row level security;
drop policy if exists "applicants and owners read opportunity change history" on public.opportunity_change_history;
create policy "applicants and owners read opportunity change history"
on public.opportunity_change_history for select to authenticated
using (
  exists (select 1 from public.applications a where a.opportunity_id = opportunity_id and a.applicant_user_id = auth.uid())
  or exists (select 1 from public.opportunities o where o.id = opportunity_id and (o.created_by = auth.uid() or (o.business_id is not null and public.is_business_member(o.business_id))))
);

create or replace function public.log_opportunity_field_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare changed jsonb;
begin
  changed := jsonb_strip_nulls(jsonb_build_object(
    'title', case when old.title is distinct from new.title then jsonb_build_object('old',old.title,'new',new.title) end,
    'description', case when old.summary is distinct from new.summary then jsonb_build_object('old',old.summary,'new',new.summary) end,
    'pay_rwf', case when old.pay_rwf is distinct from new.pay_rwf then jsonb_build_object('old',old.pay_rwf,'new',new.pay_rwf) end,
    'pay_unit', case when old.pay_unit is distinct from new.pay_unit then jsonb_build_object('old',old.pay_unit,'new',new.pay_unit) end,
    'district', case when old.district is distinct from new.district then jsonb_build_object('old',old.district,'new',new.district) end,
    'sector', case when old.sector is distinct from new.sector then jsonb_build_object('old',old.sector,'new',new.sector) end,
    'type', case when old.type is distinct from new.type then jsonb_build_object('old',old.type,'new',new.type) end,
    'mode', case when old.mode is distinct from new.mode then jsonb_build_object('old',old.mode,'new',new.mode) end,
    'duration', case when old.duration is distinct from new.duration then jsonb_build_object('old',old.duration,'new',new.duration) end,
    'deadline', case when old.deadline is distinct from new.deadline then jsonb_build_object('old',old.deadline,'new',new.deadline) end,
    'skills', case when old.skills is distinct from new.skills then jsonb_build_object('old',old.skills,'new',new.skills) end,
    'responsibilities', case when old.responsibilities is distinct from new.responsibilities then jsonb_build_object('old',old.responsibilities,'new',new.responsibilities) end,
    'requirements', case when old.requirements is distinct from new.requirements then jsonb_build_object('old',old.requirements,'new',new.requirements) end
  ));
  if changed <> '{}'::jsonb then
    insert into public.opportunity_change_history(opportunity_id, terms_version, changed_fields)
    values (new.id, old.terms_version + 1, changed);
  end if;
  return new;
end;
$$;
drop trigger if exists log_opportunity_field_changes on public.opportunities;
create trigger log_opportunity_field_changes
after update of title,summary,pay_rwf,pay_unit,district,sector,type,mode,duration,deadline,skills,responsibilities,requirements
on public.opportunities for each row
when (old.title is distinct from new.title or old.summary is distinct from new.summary or old.pay_rwf is distinct from new.pay_rwf or old.pay_unit is distinct from new.pay_unit or old.district is distinct from new.district or old.sector is distinct from new.sector or old.type is distinct from new.type or old.mode is distinct from new.mode or old.duration is distinct from new.duration or old.deadline is distinct from new.deadline or old.skills is distinct from new.skills or old.responsibilities is distinct from new.responsibilities or old.requirements is distinct from new.requirements)
execute function public.log_opportunity_field_changes();
