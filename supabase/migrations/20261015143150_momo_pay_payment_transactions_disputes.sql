-- Lightweight MoMo Pay transaction ledger and payment disputes.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  milestone_id uuid references public.milestones(id) on delete restrict,
  payment_mode text not null check (payment_mode in ('milestone','full_contract')),
  provider text not null default 'momo_pay' check (provider in ('momo_pay')),
  amount_rwf bigint not null check (amount_rwf > 0),
  currency text not null default 'RWF' check (currency = 'RWF'),
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled','refunded')),
  payer_user_id uuid not null references auth.users(id) on delete restrict,
  payer_phone text,
  provider_reference text,
  provider_transaction_id text,
  idempotency_key text not null,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  initiated_at timestamptz not null default now(),
  paid_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_transactions_idempotency_unique unique (payer_user_id, idempotency_key)
);
create index if not exists payment_transactions_contract_idx on public.payment_transactions(contract_id, created_at desc);
create index if not exists payment_transactions_milestone_idx on public.payment_transactions(milestone_id, created_at desc);
create index if not exists payment_transactions_status_idx on public.payment_transactions(status, created_at desc);
create unique index if not exists payment_transactions_provider_txn_unique on public.payment_transactions(provider, provider_transaction_id) where provider_transaction_id is not null;
create unique index if not exists payment_transactions_one_live_or_paid_milestone on public.payment_transactions(milestone_id) where milestone_id is not null and status in ('pending','processing','paid');
create unique index if not exists payment_transactions_one_live_or_paid_contract on public.payment_transactions(contract_id) where payment_mode = 'full_contract' and status in ('pending','processing','paid');

create table if not exists public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  milestone_id uuid references public.milestones(id) on delete restrict,
  opened_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 5000),
  status text not null default 'open' check (status in ('open','under_review','resolved_payer','resolved_recipient','closed')),
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_disputes_contract_idx on public.payment_disputes(contract_id, created_at desc);
create index if not exists payment_disputes_status_idx on public.payment_disputes(status, created_at desc);
create unique index if not exists payment_disputes_one_open_per_transaction on public.payment_disputes(payment_transaction_id) where status in ('open','under_review');

alter table public.contracts add column if not exists payment_plan text not null default 'full_contract' check (payment_plan in ('milestone','full_contract'));
alter table public.payment_transactions enable row level security;
alter table public.payment_disputes enable row level security;
drop policy if exists payment_transactions_party_select on public.payment_transactions;
create policy payment_transactions_party_select on public.payment_transactions for select to authenticated using (public.is_contract_party(contract_id));
drop policy if exists payment_disputes_party_select on public.payment_disputes;
create policy payment_disputes_party_select on public.payment_disputes for select to authenticated using (public.is_contract_party(contract_id));
revoke all on public.payment_transactions from anon, authenticated;
grant select on public.payment_transactions to authenticated;
revoke all on public.payment_disputes from anon, authenticated;
grant select on public.payment_disputes to authenticated;

create or replace function public.create_payment_intent(_contract_id uuid, _payment_mode text, _idempotency_key text, _milestone_id uuid default null, _payer_phone text default null)
returns public.payment_transactions language plpgsql security definer set search_path = public
as $function$
declare c public.contracts%rowtype; m public.milestones%rowtype; existing public.payment_transactions%rowtype; result_row public.payment_transactions%rowtype; payment_amount bigint;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if coalesce(length(btrim(_idempotency_key)),0) < 8 or length(_idempotency_key) > 128 then raise exception 'A valid idempotency key is required'; end if;
  if _payment_mode not in ('milestone','full_contract') then raise exception 'Unsupported payment mode'; end if;
  if _payer_phone is not null and length(regexp_replace(_payer_phone, '[^0-9+]', '', 'g')) not between 9 and 16 then raise exception 'Enter a valid mobile money phone number'; end if;
  select * into c from public.contracts where id = _contract_id and deleted_at is null for update;
  if not found then raise exception 'Contract not found' using errcode = 'P0002'; end if;
  if not public.is_business_member(c.business_id, array['owner','admin']) then raise exception 'Only a business owner or admin can initiate contract payments' using errcode = '42501'; end if;
  if c.status not in ('active','completed') then raise exception 'Payments are available only for active or completed contracts'; end if;
  if c.payment_plan <> _payment_mode then raise exception 'Payment mode does not match the agreed contract payment plan'; end if;
  if _payment_mode = 'milestone' then
    if _milestone_id is null then raise exception 'Select a milestone to pay'; end if;
    select * into m from public.milestones where id = _milestone_id and contract_id = c.id for update;
    if not found then raise exception 'Milestone not found for this contract' using errcode = 'P0002'; end if;
    if m.status <> 'approved' then raise exception 'Only approved milestones can be paid'; end if;
    payment_amount := m.amount_rwf;
  else
    if _milestone_id is not null then raise exception 'Full-contract payment must not reference a milestone'; end if;
    if c.status <> 'completed' then raise exception 'Full-contract payment can start after the contract is completed'; end if;
    payment_amount := c.amount_rwf;
  end if;
  select * into existing from public.payment_transactions where payer_user_id = auth.uid() and idempotency_key = _idempotency_key;
  if found then return existing; end if;
  if exists (select 1 from public.payment_transactions pt where pt.contract_id = c.id and pt.status in ('pending','processing') and ((_payment_mode = 'milestone' and pt.milestone_id = _milestone_id) or (_payment_mode = 'full_contract' and pt.payment_mode = 'full_contract'))) then
    select * into result_row from public.payment_transactions pt where pt.contract_id = c.id and pt.status in ('pending','processing') and ((_payment_mode = 'milestone' and pt.milestone_id = _milestone_id) or (_payment_mode = 'full_contract' and pt.payment_mode = 'full_contract')) order by pt.created_at desc limit 1;
    return result_row;
  end if;
  insert into public.payment_transactions(contract_id,milestone_id,payment_mode,amount_rwf,payer_user_id,payer_phone,idempotency_key)
  values(c.id,_milestone_id,_payment_mode,payment_amount,auth.uid(),nullif(btrim(_payer_phone),''),_idempotency_key) returning * into result_row;
  insert into public.notifications(user_id,kind,text,link)
  select wp.user_id,'payment_initiated','A MoMo Pay payment was initiated for '||c.title,'/contracts/'||c.id::text from public.worker_profiles wp where c.worker_id is not null and wp.id::text=c.worker_id and wp.user_id is not null;
  insert into public.notifications(user_id,kind,text,link)
  select t.lead_user_id,'payment_initiated','A MoMo Pay payment was initiated for '||c.title,'/contracts/'||c.id::text from public.teams t where c.team_id is not null and t.id::text=c.team_id and t.lead_user_id is not null;
  return result_row;
end;
$function$;
revoke all on function public.create_payment_intent(uuid,text,text,uuid,text) from public, anon;
grant execute on function public.create_payment_intent(uuid,text,text,uuid,text) to authenticated;

create or replace function public.open_payment_dispute(_payment_transaction_id uuid, _reason text)
returns public.payment_disputes language plpgsql security definer set search_path = public
as $function$
declare p public.payment_transactions%rowtype; c public.contracts%rowtype; d public.payment_disputes%rowtype; other_user uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(_reason,''))) not between 10 and 5000 then raise exception 'Explain the payment dispute in 10 to 5000 characters'; end if;
  select * into p from public.payment_transactions where id = _payment_transaction_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if not public.is_contract_party(p.contract_id) then raise exception 'Only contract parties can open a payment dispute' using errcode = '42501'; end if;
  if p.status not in ('pending','processing','paid','failed') then raise exception 'This payment cannot be disputed in its current state'; end if;
  select * into c from public.contracts where id = p.contract_id;
  insert into public.payment_disputes(payment_transaction_id,contract_id,milestone_id,opened_by,reason) values(p.id,p.contract_id,p.milestone_id,auth.uid(),btrim(_reason)) returning * into d;
  if public.is_business_member(c.business_id) then
    select wp.user_id into other_user from public.worker_profiles wp where c.worker_id is not null and wp.id::text=c.worker_id limit 1;
    if other_user is null and c.team_id is not null then select t.lead_user_id into other_user from public.teams t where t.id::text=c.team_id limit 1; end if;
  else
    select bm.user_id into other_user from public.business_members bm where bm.business_id::text=c.business_id and bm.user_id is not null order by case when bm.role in ('owner','admin') then 0 else 1 end limit 1;
  end if;
  if other_user is not null and other_user <> auth.uid() then insert into public.notifications(user_id,kind,text,link) values(other_user,'payment_dispute_opened','A payment dispute was opened for '||c.title,'/contracts/'||c.id::text); end if;
  return d;
end;
$function$;
revoke all on function public.open_payment_dispute(uuid,text) from public, anon;
grant execute on function public.open_payment_dispute(uuid,text) to authenticated;

create or replace function public.touch_payment_transaction_updated_at()
returns trigger language plpgsql set search_path = public as $function$
begin new.updated_at := now(); return new; end;
$function$;
drop trigger if exists payment_transactions_touch_updated_at on public.payment_transactions;
create trigger payment_transactions_touch_updated_at before update on public.payment_transactions for each row execute function public.touch_payment_transaction_updated_at();
drop trigger if exists payment_disputes_touch_updated_at on public.payment_disputes;
create trigger payment_disputes_touch_updated_at before update on public.payment_disputes for each row execute function public.touch_payment_transaction_updated_at();
comment on table public.payment_transactions is 'MoMo Pay transaction ledger. Provider secrets and verified callbacks remain server-side.';
comment on table public.payment_disputes is 'Auditable disputes attached to a payment transaction and contract.';
