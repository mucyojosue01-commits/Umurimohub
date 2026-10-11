-- Notify active applicants when an opportunity is closed or ended.
-- Deletion is represented as status='deleted' so work history and notices remain consistent.
create or replace function public.notify_opportunity_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare status_label text;
begin
  if old.status is distinct from new.status and new.status in ('closed', 'deleted') then
    status_label := case when new.status = 'closed' then 'recently closed' else 'ended' end;
    insert into public.notifications(user_id, kind, text, link)
    select a.applicant_user_id,
      case when new.status = 'closed' then 'opportunity_closed' else 'opportunity_ended' end,
      'Opportunity ' || status_label || ': ' || new.title || '. This opportunity is no longer accepting applications.',
      '/opportunities/' || new.id
    from public.applications a
    where a.opportunity_id = new.id
      and a.status not in ('withdrawn', 'rejected');
  end if;
  return new;
end;
$$;

drop trigger if exists opportunity_status_changed on public.opportunities;
create trigger opportunity_status_changed
after update of status on public.opportunities
for each row
execute function public.notify_opportunity_status_change();

-- Keep referrals from surfacing against closed/ended opportunities in user-facing reads.
create or replace function public.referral_opportunity_is_open(_opportunity_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.opportunities o
    where o.id = _opportunity_id and o.status = 'open' and coalesce(o.is_demo, false) = false
  );
$$;
revoke all on function public.referral_opportunity_is_open(text) from public, anon;
grant execute on function public.referral_opportunity_is_open(text) to authenticated;
