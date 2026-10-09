-- Include both the opportunity and hiring business in contract-proposal notifications.
-- The contract remains tied to the accepted application; this does not allow cross-business assignment.
create or replace function public.create_contract(
  _application_id uuid,
  _title text,
  _scope text,
  _amount_rwf bigint,
  _start_date date default null,
  _end_date date default null,
  _terms text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a record;
  o record;
  b record;
  wid text;
  cid uuid;
  cp uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into a from public.applications where id = _application_id;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;

  select * into o from public.opportunities where id = a.opportunity_id;
  if not found then raise exception 'Opportunity not found' using errcode = 'P0002'; end if;

  if not public.is_business_member(o.business_id) then
    raise exception 'Only members of the hiring business can create contracts' using errcode = '42501';
  end if;
  if coalesce(o.is_demo, false) then raise exception 'Demo opportunities cannot have contracts'; end if;
  if a.status <> 'accepted' then raise exception 'Only accepted applications can get a contract'; end if;
  if exists (select 1 from public.contracts where application_id = _application_id) then
    raise exception 'A contract already exists for this application' using errcode = '23505';
  end if;

  if a.team_id is null then
    select id into wid from public.worker_profiles where user_id = a.applicant_user_id limit 1;
    if wid is null then raise exception 'Applicant has no worker profile'; end if;
  end if;

  if _amount_rwf is null or _amount_rwf <= 0 then raise exception 'Contract amount must be greater than zero'; end if;
  if char_length(btrim(coalesce(_title, ''))) < 3 or char_length(btrim(coalesce(_title, ''))) > 200 then
    raise exception 'Contract title must be 3 to 200 characters';
  end if;
  if char_length(btrim(coalesce(_scope, ''))) < 10 then raise exception 'Contract scope must be at least 10 characters'; end if;
  if _end_date is not null and _start_date is not null and _end_date < _start_date then
    raise exception 'End date must be on or after start date';
  end if;

  insert into public.contracts(
    application_id, opportunity_id, business_id, worker_id, team_id,
    title, scope, amount_rwf, start_date, end_date, terms, proposed_by
  ) values (
    a.id, o.id, o.business_id, wid, a.team_id,
    btrim(_title), btrim(_scope), _amount_rwf, _start_date, _end_date,
    nullif(btrim(coalesce(_terms, '')), ''), auth.uid()
  ) returning id into cid;

  insert into public.contract_events(contract_id, actor, event_type, from_status, to_status)
  values (cid, auth.uid(), 'proposed', null, 'proposed');

  select * into b from public.businesses where id = o.business_id;
  cp := public.contract_counterparty_user(cid);
  if cp is not null then
    insert into public.notifications(user_id, kind, text, link)
    values (
      cp,
      'contract_proposed',
      'New proposal for "' || coalesce(o.title, 'Opportunity') || '" from ' ||
        coalesce(b.name, 'the hiring business') || ': ' || btrim(_title),
      '/dashboard'
    );
  end if;

  return cid;
end;
$function$;
