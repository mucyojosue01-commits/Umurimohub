-- Prevent accidental reopening of a company position while its employee is active.
-- Republish is allowed only after the employment-management workflow ends the employment.
create or replace function public.prevent_reopening_filled_company_position()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'Job'
     and new.status = 'open'
     and old.status is distinct from new.status
     and exists (
       select 1
       from public.company_employments e
       where e.opportunity_id = new.id
         and e.status = 'active'
     )
  then
    raise exception 'This position already has an active employee. End the employment before publishing the position again.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_reopening_filled_company_position on public.opportunities;
create trigger prevent_reopening_filled_company_position
before update of status on public.opportunities
for each row
execute function public.prevent_reopening_filled_company_position();
