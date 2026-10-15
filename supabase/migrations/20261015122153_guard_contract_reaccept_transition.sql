-- A cancelled contract may only be reactivated through the authorized reaccept RPC.
-- Direct table updates must not bypass its party authorization, event, and notification logic.
create or replace function public.guard_contract_update()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
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
    or (
      old.status = 'cancelled'
      and new.status = 'active'
      and coalesce(current_setting('app.contract_reaccept_authorized', true), 'false') = 'true'
    )
  ) then
    raise exception 'Invalid contract transition % -> %', old.status, new.status;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.reaccept_cancelled_contract(_contract_id uuid)
returns public.contract_status
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c record;
  uid uuid := auth.uid();
  cp uuid;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into c
    from public.contracts
   where id = _contract_id
   for update;

  if not found then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if c.status <> 'cancelled' then
    raise exception 'Only cancelled contracts can be re-accepted';
  end if;

  if not (
    public.is_business_member(c.business_id)
    or (c.worker_id is not null and c.worker_id = public.my_worker_id())
    or (c.team_id is not null and public.is_team_lead(c.team_id, uid))
  ) then
    raise exception 'Only a contracting party can re-accept this contract' using errcode = '42501';
  end if;

  perform set_config('app.contract_reaccept_authorized', 'true', true);
  update public.contracts
     set status = 'active',
         cancelled_at = null,
         accepted_at = coalesce(accepted_at, now()),
         activated_at = coalesce(activated_at, now()),
         updated_at = now()
   where id = c.id;
  perform set_config('app.contract_reaccept_authorized', 'false', true);

  insert into public.contract_events(contract_id,actor,event_type,from_status,to_status,note)
  values(c.id,uid,'reaccepted','cancelled','active','Cancelled contract re-accepted');

  cp := public.contract_counterparty_user(c.id);
  if cp is not null and cp <> uid then
    insert into public.notifications(user_id,kind,text,link)
    values(cp,'contract_reaccepted','Contract re-accepted: '||c.title,'/contracts/'||c.id);
  end if;

  return 'active';
end;
$function$;
