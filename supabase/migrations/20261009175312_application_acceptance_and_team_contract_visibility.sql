-- Record when applications are accepted and let active team members see team contracts.
alter table public.applications
  add column if not exists accepted_at timestamptz;

create or replace function public.set_application_accepted_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status::text = 'accepted' and old.status::text is distinct from new.status::text then
    new.accepted_at := coalesce(new.accepted_at, now());
  elsif new.status::text <> 'accepted' and old.status::text = 'accepted' then
    new.accepted_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_set_accepted_at on public.applications;
create trigger applications_set_accepted_at
before update of status on public.applications
for each row execute function public.set_application_accepted_at();

create or replace function public.is_active_contract_team_member(_team_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members as tm
    join public.worker_profiles as wp on wp.id = tm.worker_id
    where tm.team_id = _team_id
      and tm.status = 'active'
      and wp.user_id = auth.uid()
  );
$$;

revoke all on function public.is_active_contract_team_member(text) from public;
grant execute on function public.is_active_contract_team_member(text) to authenticated;

drop policy if exists "parties read contracts" on public.contracts;
create policy "parties read contracts"
on public.contracts
for select
to authenticated
using (
  public.is_business_member(business_id)
  or (worker_id is not null and worker_id = public.my_worker_id())
  or (team_id is not null and public.is_team_lead(team_id))
  or (team_id is not null and public.is_active_contract_team_member(team_id))
);
