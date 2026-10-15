-- Link hiring offers/employment to the exact company position and application.
alter table public.employment_offers
  add column if not exists opportunity_id text references public.opportunities(id) on delete set null,
  add column if not exists application_id uuid references public.applications(id) on delete set null;
alter table public.company_employments
  add column if not exists opportunity_id text references public.opportunities(id) on delete set null,
  add column if not exists application_id uuid references public.applications(id) on delete set null,
  add column if not exists ended_by uuid;

update public.employment_offers o
set opportunity_id = a.opportunity_id
from public.applications a
where o.application_id = a.id and o.opportunity_id is null;

update public.company_employments e
set opportunity_id = o.opportunity_id,
    application_id = coalesce(e.application_id, o.application_id)
from public.employment_offers o
where e.offer_id = o.id and e.opportunity_id is null;

-- Backfill old employments by exact company/title match where no offer linkage exists.
update public.company_employments e
set opportunity_id = (
  select p.id
  from public.opportunities p
  where p.business_id = e.business_id
    and p.type = 'Job'
    and lower(trim(p.title)) = lower(trim(e.position_name))
  order by p.created_at desc
  limit 1
)
where e.opportunity_id is null and e.status = 'active'
  and exists (
    select 1 from public.opportunities p
    where p.business_id = e.business_id
      and p.type = 'Job'
      and lower(trim(p.title)) = lower(trim(e.position_name))
  );

-- Ensure the position view/list never advertises a role that already has an accepted employee.
update public.opportunities p
set status = 'closed'
where p.type = 'Job' and p.status = 'open'
  and exists (
    select 1 from public.company_employments e
    where e.opportunity_id = p.id and e.status = 'active'
  );

-- New applications accept the current terms version automatically. Only applications
-- that existed before an edit must review and accept the changed terms.
create or replace function public.set_new_application_terms_version()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select coalesce(o.terms_version, 1) into new.accepted_terms_version
  from public.opportunities o where o.id = new.opportunity_id;
  new.accepted_terms_version := coalesce(new.accepted_terms_version, 1);
  return new;
end;
$$;
drop trigger if exists applications_set_current_terms_version on public.applications;
create trigger applications_set_current_terms_version
before insert on public.applications
for each row execute function public.set_new_application_terms_version();

-- Company-only hiring stage transitions and offer creation.
create or replace function public.set_position_application_status(
  _application_id uuid,
  _status text,
  _note text default null,
  _employment_type text default 'full_time',
  _offer_details text default ''
)
returns public.applications
language plpgsql security definer set search_path = public
as $$
declare
  a public.applications;
  p public.opportunities;
  worker_row public.worker_profiles;
  offer_row public.employment_offers;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if _status not in ('viewed','under_review','shortlisted','interview','offer','rejected','withdrawn') then
    raise exception 'Invalid hiring stage';
  end if;
  select * into a from public.applications where id = _application_id for update;
  if not found then raise exception 'Application not found'; end if;
  select * into p from public.opportunities where id = a.opportunity_id for update;
  if not found or p.type <> 'Job' or p.business_id is null then raise exception 'Company position not found'; end if;
  if not public.is_business_member(p.business_id) and not public.has_role('admin'::public.app_role, auth.uid()) then
    raise exception 'Only authorized company members can manage this application' using errcode = '42501';
  end if;
  if a.status in ('accepted','rejected','withdrawn') then raise exception 'This application is already closed'; end if;

  if _status = 'offer' then
    if _employment_type not in ('full_time','part_time','contract','temporary','apprenticeship') then raise exception 'Invalid employment type'; end if;
    if p.status <> 'open' then raise exception 'This position is no longer open'; end if;
    select * into worker_row from public.worker_profiles where user_id = a.applicant_user_id limit 1;
    if not found then raise exception 'Applicant must complete a worker profile before receiving an employment offer'; end if;
    if exists (select 1 from public.company_employments e where e.business_id=p.business_id and e.worker_user_id=a.applicant_user_id and e.status='active')
       or exists (select 1 from public.employment_offers eo where eo.business_id=p.business_id and eo.worker_user_id=a.applicant_user_id and eo.status='pending') then
      raise exception 'This person already has an active position or pending offer at this company';
    end if;
    insert into public.employment_offers(
      business_id, worker_id, worker_user_id, position_name, employment_type, details,
      offered_by, application_id, opportunity_id
    ) values (
      p.business_id, worker_row.id, a.applicant_user_id, coalesce(nullif(trim(p.position_name),''),p.title),
      _employment_type, coalesce(_offer_details,''), auth.uid(), a.id, p.id
    ) returning * into offer_row;
    update public.applications set status='offer', updated_at=now() where id=a.id returning * into a;
  else
    update public.applications set status=_status::public.application_status, updated_at=now() where id=a.id returning * into a;
    insert into public.notifications(user_id,kind,text,link)
    values(a.applicant_user_id,'position_application_update',
      'Your application for "' || p.title || '" has been updated to ' || replace(_status,'_',' ') || '.',
      '/positions/' || p.id);
  end if;
  return a;
end;
$$;
revoke all on function public.set_position_application_status(uuid,text,text,text,text) from public, anon;
grant execute on function public.set_position_application_status(uuid,text,text,text,text) to authenticated;

-- Accepting an offer creates the employment record and closes the filled position.
drop function if exists public.respond_to_employment_offer(uuid,text);
create function public.respond_to_employment_offer(_offer_id uuid, _decision text)
returns public.employment_offers
language plpgsql security definer set search_path = public
as $$
declare
  offer_row public.employment_offers;
  company_name text;
begin
  if _decision not in ('accepted','declined') then raise exception 'Invalid offer decision'; end if;
  select * into offer_row from public.employment_offers where id=_offer_id for update;
  if not found then raise exception 'Employment offer not found'; end if;
  if offer_row.worker_user_id <> auth.uid() then raise exception 'Only the invited worker can respond'; end if;
  if offer_row.status <> 'pending' then raise exception 'This offer is no longer pending'; end if;
  update public.employment_offers set status=_decision, responded_at=now(), updated_at=now() where id=_offer_id returning * into offer_row;
  if _decision='accepted' then
    insert into public.company_employments(
      business_id,worker_id,worker_user_id,position_name,employment_type,offer_id,opportunity_id,application_id
    ) values (
      offer_row.business_id,offer_row.worker_id,offer_row.worker_user_id,offer_row.position_name,
      offer_row.employment_type,offer_row.id,offer_row.opportunity_id,offer_row.application_id
    )
    on conflict (offer_id) do update set
      position_name=excluded.position_name,status='active',ended_at=null,ended_by=null,updated_at=now();
    if offer_row.opportunity_id is not null then
      update public.opportunities set status='closed'
      where id=offer_row.opportunity_id and type='Job' and status='open';
    end if;
    if offer_row.application_id is not null then
      update public.applications set status='accepted',updated_at=now() where id=offer_row.application_id;
    end if;
    select name into company_name from public.businesses where id=offer_row.business_id;
    insert into public.notifications(user_id,kind,text,link)
    select bm.user_id,'employment_accepted',
      coalesce((select name from public.worker_profiles where id=offer_row.worker_id),'A worker') ||
      ' accepted the ' || offer_row.position_name || ' position at ' || coalesce(company_name,'your company') || '.',
      '/business/' || offer_row.business_id
    from public.business_members bm where bm.business_id=offer_row.business_id and bm.user_id<>auth.uid();
  end if;
  return offer_row;
end;
$$;
revoke all on function public.respond_to_employment_offer(uuid,text) from public, anon;
grant execute on function public.respond_to_employment_offer(uuid,text) to authenticated;

-- Edit an employee's position or end employment. Republish only the linked position,
-- and notify the employee in respectful language.
drop function if exists public.manage_company_employment(uuid,text,text);
create function public.manage_company_employment(
  _employment_id uuid,
  _action text,
  _position_name text default null,
  _republish boolean default false,
  _employment_type text default null
)
returns public.company_employments
language plpgsql security definer set search_path = public
as $$
declare
  employment_row public.company_employments;
  company_name text;
  worker_name text;
begin
  if _action not in ('update_position','end') then raise exception 'Invalid employment action'; end if;
  select * into employment_row from public.company_employments where id=_employment_id for update;
  if not found then raise exception 'Employment record not found'; end if;
  if not public.is_business_member(employment_row.business_id) and not public.has_role('admin'::public.app_role,auth.uid()) then
    raise exception 'Only authorized company members can manage employees';
  end if;
  if employment_row.status<>'active' then raise exception 'This employment is already ended'; end if;
  if _action='update_position' then
    if _position_name is null or length(trim(_position_name)) not between 2 and 120 then raise exception 'Position name must be 2–120 characters'; end if;
    if _employment_type is not null and _employment_type not in ('full_time','part_time','contract','temporary','apprenticeship') then raise exception 'Invalid employment type'; end if;
    update public.company_employments
    set position_name=trim(_position_name), employment_type=coalesce(_employment_type,employment_type), updated_at=now()
    where id=_employment_id returning * into employment_row;
  else
    if _republish and employment_row.opportunity_id is null then raise exception 'This employment has no linked position to republish'; end if;
    if _republish and exists(select 1 from public.opportunities where id=employment_row.opportunity_id and deadline<current_date) then
      raise exception 'The saved position deadline has passed. Edit the deadline before republishing.';
    end if;
    update public.company_employments
    set status='ended',ended_at=current_date,ended_by=auth.uid(),updated_at=now()
    where id=_employment_id returning * into employment_row;
    if _republish and employment_row.opportunity_id is not null then
      update public.opportunities set status='open'
      where id=employment_row.opportunity_id and type='Job';
    end if;
  end if;
  select name into company_name from public.businesses where id=employment_row.business_id;
  select name into worker_name from public.worker_profiles where id=employment_row.worker_id;
  insert into public.notifications(user_id,kind,text,link)
  values (
    employment_row.worker_user_id,
    case when _action='end' then 'employment_ended' else 'employment_position_updated' end,
    case when _action='end' then
      'Thank you for your work with ' || coalesce(company_name,'the company') || '. Your employment as ' || employment_row.position_name || ' has ended. We wish you success in your next opportunity.'
    else
      coalesce(company_name,'The company') || ' updated your position to ' || employment_row.position_name || '.'
    end,
    '/notifications'
  );
  return employment_row;
end;
$$;
revoke all on function public.manage_company_employment(uuid,text,text,boolean,text) from public, anon;
grant execute on function public.manage_company_employment(uuid,text,text,boolean,text) to authenticated;
