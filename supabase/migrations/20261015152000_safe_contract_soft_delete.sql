-- Soft-delete only an unaccepted proposal so application, payment, milestone,
-- and contract-event records are never cascaded or destroyed.
alter table public.contracts
  add column if not exists deleted_at timestamptz;

create index if not exists contracts_visible_idx
  on public.contracts (created_at desc)
  where deleted_at is null;

create or replace function public.delete_contract(_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  c public.contracts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into c
  from public.contracts
  where id = _contract_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Contract not found or already deleted' using errcode = 'P0002';
  end if;

  if not public.is_business_member(c.business_id) then
    raise exception 'Only a member of the hiring business can delete a proposal' using errcode = '42501';
  end if;

  if c.status <> 'proposed' then
    raise exception 'Only unaccepted contract proposals can be deleted';
  end if;

  update public.contracts
  set deleted_at = now()
  where id = _contract_id;
end;
$function$;

revoke all on function public.delete_contract(uuid) from public;
grant execute on function public.delete_contract(uuid) to authenticated;
