create or replace function public.notify_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    insert into public.notifications(user_id,kind,text,link)
    values(new.applicant_user_id,'application_accepted','Application accepted','/dashboard');
  end if;
  return new;
end;
$$;

drop trigger if exists application_status_notification on public.applications;
create trigger application_status_notification
after update of status on public.applications
for each row execute function public.notify_application_status_change();
revoke execute on function public.notify_application_status_change() from public, anon, authenticated;