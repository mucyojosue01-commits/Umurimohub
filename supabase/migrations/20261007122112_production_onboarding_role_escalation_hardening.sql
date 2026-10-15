-- Security hardening: users may self-assign only onboarding roles.
-- Privileged roles (admin, institution) must never be self-assignable.
drop policy if exists "roles self insert" on public.user_roles;

create policy "roles self insert"
on public.user_roles
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role in (
    'worker'::public.app_role,
    'team_lead'::public.app_role,
    'business'::public.app_role,
    'learner'::public.app_role
  )
);
