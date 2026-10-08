create or replace function public.guard_contract_update()
returns trigger language plpgsql set search_path=public
as $$
begin
  if new.application_id <> old.application_id
    or new.opportunity_id <> old.opportunity_id
    or new.business_id <> old.business_id
    or new.worker_id is distinct from old.worker_id
    or new.team_id is distinct from old.team_id
    or new.amount_rwf <> old.amount_rwf
    or new.currency <> old.currency
    or new.title <> old.title
    or new.scope <> old.scope
    or new.proposed_by <> old.proposed_by
    or new.is_demo <> old.is_demo
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
    or new.terms is distinct from old.terms then
    raise exception 'Contract terms and parties are immutable';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'proposed' and new.status in ('active','declined','cancelled'))
    or (old.status = 'active' and new.status in ('cancelled','completed'))
    or (old.status = 'cancelled' and new.status = 'active')
  ) then
    raise exception 'Invalid contract transition % -> %', old.status, new.status;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
