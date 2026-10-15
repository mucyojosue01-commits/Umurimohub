-- Make terms acceptance reliable for newly created applications while preserving
-- the acceptance version of existing applicants after opportunity edits.
create or replace function public.set_new_application_terms_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_terms_version integer;
begin
  if tg_op = 'UPDATE'
     and new.opportunity_id is not distinct from old.opportunity_id
     and new.applicant_user_id is not distinct from old.applicant_user_id then
    -- Status/note edits must never silently accept revised terms for an existing applicant.
    new.accepted_terms_version := old.accepted_terms_version;
    return new;
  end if;

  select coalesce(o.terms_version, 1)
    into current_terms_version
  from public.opportunities o
  where o.id = new.opportunity_id;

  new.accepted_terms_version := coalesce(current_terms_version, 1);
  return new;
end;
$$;

drop trigger if exists applications_set_current_terms_version on public.applications;
create trigger applications_set_current_terms_version
before insert or update of opportunity_id, applicant_user_id on public.applications
for each row execute function public.set_new_application_terms_version();

-- Enforce the filled-position invariant at the database layer too, including
-- employment rows created by any future hiring workflow.
create or replace function public.close_position_when_employment_starts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and new.opportunity_id is not null then
    update public.opportunities
       set status = 'closed'
     where id = new.opportunity_id
       and type = 'Job'
       and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists company_employment_closes_position on public.company_employments;
create trigger company_employment_closes_position
after insert or update of status, opportunity_id on public.company_employments
for each row execute function public.close_position_when_employment_starts();

-- Ensure the RPC retains its public contract and only company members can use it.
revoke all on function public.manage_company_employment(uuid, text, text, boolean, text) from public, anon;
grant execute on function public.manage_company_employment(uuid, text, text, boolean, text) to authenticated;
