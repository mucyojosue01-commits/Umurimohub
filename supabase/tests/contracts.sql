-- Manual contract schema/security smoke test.
-- Run with a privileged database connection in a disposable transaction.
-- RLS impersonation must be supplied by the test harness when available.

begin;

do $$
declare
  c text;
begin
  select udt_name into c
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'contracts'
    and column_name = 'amount_rwf';

  if c <> 'int8' then
    raise exception 'contracts.amount_rwf must be bigint';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contracts'::regclass
      and conname = 'contracts_one_counterparty'
  ) then
    raise exception 'missing exactly-one-counterparty constraint';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contracts'::regclass
      and conname like '%application_id%'
      and contype = 'u'
  ) then
    raise exception 'missing unique application_id constraint';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.contract_events'::regclass
      and tgname = 'contract_events_immutable'
  ) then
    raise exception 'missing immutable event trigger';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.contracts'::regclass
      and tgname = 'guard_contract'
  ) then
    raise exception 'missing contract lifecycle guard';
  end if;
end $$;

rollback;
