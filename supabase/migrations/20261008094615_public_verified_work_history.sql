drop policy if exists "verified experiences public read" on public.verified_experiences;
create policy "verified experiences public read"
on public.verified_experiences for select
to authenticated
using (
  (worker_id is not null and exists (
    select 1 from public.worker_profiles w
    where w.id = verified_experiences.worker_id
      and w.visibility = 'public'
      and coalesce(w.is_demo,false) = false
  ))
  or
  (team_id is not null and exists (
    select 1 from public.teams t
    where t.id = verified_experiences.team_id
      and coalesce(t.is_demo,false) = false
  ))
  or is_business_member(business_id)
  or has_role('admin'::public.app_role, auth.uid())
);