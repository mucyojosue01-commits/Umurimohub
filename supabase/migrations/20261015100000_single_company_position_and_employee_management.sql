-- Ensure an employee has only one current position in a given company.
-- Historical ended employments are retained.
with ranked as (
  select id, row_number() over (partition by business_id, worker_user_id order by started_at, created_at, id) as rn
  from public.company_employments
  where status = 'active'
)
update public.company_employments e set status = 'ended', ended_at = current_date, updated_at = now()
from ranked r where e.id = r.id and r.rn > 1;

create unique index if not exists company_employments_one_active_position_per_worker
  on public.company_employments (business_id, worker_user_id)
  where status = 'active';

create or replace function public.guard_single_company_position()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'active' and exists (
    select 1 from public.company_employments e
    where e.business_id = new.business_id
      and e.worker_user_id = new.worker_user_id
      and e.status = 'active'
      and e.id is distinct from new.id
  ) then
    raise exception 'This person already has an active position in this company. End or edit the existing position first.';
  end if;
  return new;
end;
$$;

drop trigger if exists company_employments_single_active_position on public.company_employments;
create trigger company_employments_single_active_position
before insert or update of business_id, worker_user_id, status on public.company_employments
for each row execute function public.guard_single_company_position();

create or replace function public.guard_single_pending_employment_offer()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'pending' and (
    exists (select 1 from public.company_employments e where e.business_id = new.business_id and e.worker_user_id = new.worker_user_id and e.status = 'active')
    or exists (select 1 from public.employment_offers o where o.business_id = new.business_id and o.worker_user_id = new.worker_user_id and o.status = 'pending' and o.id is distinct from new.id)
  ) then
    raise exception 'This person already has an active position or a pending offer at this company. Resolve it before offering another position.';
  end if;
  return new;
end;
$$;

drop trigger if exists employment_offer_single_position on public.employment_offers;
create trigger employment_offer_single_position
before insert or update of business_id, worker_user_id, status on public.employment_offers
for each row execute function public.guard_single_pending_employment_offer();

create or replace function public.manage_company_employment(_employment_id uuid, _action text, _position_name text default null)
returns public.company_employments
language plpgsql security definer set search_path = public
as $$
declare
  employment_row public.company_employments;
  company_name text;
  worker_name text;
begin
  if _action not in ('update_position','end') then raise exception 'Invalid employment action'; end if;
  select * into employment_row from public.company_employments where id = _employment_id for update;
  if not found then raise exception 'Employment record not found'; end if;
  if not public.is_business_member(employment_row.business_id) and not public.has_role('admin'::public.app_role, auth.uid()) then
    raise exception 'Only authorized company members can manage employees';
  end if;
  if employment_row.status <> 'active' then raise exception 'This employment is already ended'; end if;
  if _action = 'update_position' then
    if _position_name is null or length(trim(_position_name)) not between 2 and 120 then raise exception 'Position must be 2–120 characters'; end if;
    update public.company_employments set position_name = trim(_position_name), updated_at = now()
    where id = _employment_id returning * into employment_row;
  else
    update public.company_employments set status = 'ended', ended_at = current_date, updated_at = now()
    where id = _employment_id returning * into employment_row;
  end if;
  select name into company_name from public.businesses where id = employment_row.business_id;
  select name into worker_name from public.worker_profiles where id = employment_row.worker_id;
  insert into public.notifications(user_id, kind, text, link)
  values (
    employment_row.worker_user_id,
    case when _action = 'end' then 'employment_ended' else 'employment_position_updated' end,
    case when _action = 'end'
      then coalesce(company_name,'The company') || ' has ended your employment as ' || employment_row.position_name || '.'
      else coalesce(company_name,'The company') || ' updated your position to ' || employment_row.position_name || '.'
    end,
    '/notifications'
  );
  return employment_row;
end;
$$;

revoke all on function public.manage_company_employment(uuid, text, text) from public, anon;
grant execute on function public.manage_company_employment(uuid, text, text) to authenticated;
