drop policy if exists payment_transactions_party_select on public.payment_transactions;
create policy payment_transactions_party_select on public.payment_transactions for select to authenticated
using (public.is_contract_party(contract_id) or exists (select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.role::text='admin'));
