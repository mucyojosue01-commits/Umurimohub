drop policy if exists "business owner admin update" on public.businesses;
create policy "business owner admin update" on public.businesses for update to authenticated
using (public.is_business_member(id, array['owner','admin']))
with check (public.is_business_member(id, array['owner','admin']));
drop policy if exists "business owner delete" on public.businesses;
create policy "business owner delete" on public.businesses for delete to authenticated
using (public.is_business_member(id, array['owner']));

drop policy if exists "team lead update" on public.teams;
create policy "team lead update" on public.teams for update to authenticated
using (lead_user_id = auth.uid())
with check (lead_user_id = auth.uid());
drop policy if exists "team lead delete" on public.teams;
create policy "team lead delete" on public.teams for delete to authenticated
using (lead_user_id = auth.uid());