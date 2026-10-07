drop policy if exists "applications business status update" on public.applications;
create policy "applications business status update" on public.applications
for update to authenticated
using (
  public.is_business_member((select o.business_id from public.opportunities o where o.id = opportunity_id))
)
with check (
  public.is_business_member((select o.business_id from public.opportunities o where o.id = opportunity_id))
);