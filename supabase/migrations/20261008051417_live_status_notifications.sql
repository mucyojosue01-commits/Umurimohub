create or replace function public.notify_application_status_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare recipient uuid; title text; kind text; msg text;
begin
 if new.status is not distinct from old.status then return new; end if;
 select o.title into title from public.opportunities o where o.id=new.opportunity_id;
 recipient:=new.applicant_user_id;
 if new.status='shortlisted' then kind:='application_shortlisted'; msg:='You were shortlisted for: '||coalesce(title,'an opportunity');
 elsif new.status='accepted' then kind:='application_accepted'; msg:='Your application was accepted for: '||coalesce(title,'an opportunity');
 elsif new.status='rejected' then kind:='application_rejected'; msg:='Your application was not selected for: '||coalesce(title,'an opportunity');
 else return new;
 end if;
 insert into public.notifications(user_id,kind,text,link) values(recipient,kind,msg,'/opportunities/'||new.opportunity_id);
 return new;
end;
$$;
drop trigger if exists applications_notify_status on public.applications;
create trigger applications_notify_status after update of status on public.applications for each row execute function public.notify_application_status_change();

create or replace function public.notify_team_membership_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare recipient uuid; team_name text;
begin
 select w.user_id into recipient from public.worker_profiles w where w.id=new.worker_id;
 select t.name into team_name from public.teams t where t.id=new.team_id;
 if recipient is not null then
  insert into public.notifications(user_id,kind,text,link)
  values(recipient,'team_invitation','You were invited to join '||coalesce(team_name,'a team'),'/teams/'||new.team_id);
 end if;
 return new;
end;
$$;
drop trigger if exists team_members_notify_invite on public.team_members;
create trigger team_members_notify_invite after insert on public.team_members for each row execute function public.notify_team_membership_change();