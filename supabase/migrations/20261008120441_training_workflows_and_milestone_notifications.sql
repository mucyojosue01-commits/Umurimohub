create table if not exists public.training_applications (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.training_programs(id) on delete cascade,
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  worker_id text not null references public.worker_profiles(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied','shortlisted','accepted','declined','completed')),
  note text not null default '',
  applied_at timestamptz not null default now(),
  shortlisted_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(training_id, applicant_user_id)
);

create table if not exists public.training_experiences (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.training_programs(id) on delete restrict,
  worker_id text not null references public.worker_profiles(id) on delete cascade,
  provider_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  description text not null default '',
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(training_id, worker_id)
);

create index if not exists training_applications_training_idx on public.training_applications(training_id, status, applied_at desc);
create index if not exists training_applications_worker_idx on public.training_applications(applicant_user_id, status, applied_at desc);
create index if not exists training_experiences_worker_idx on public.training_experiences(worker_id, completed_at desc);

alter table public.training_applications enable row level security;
alter table public.training_experiences enable row level security;

drop policy if exists "training applications applicant read" on public.training_applications;
create policy "training applications applicant read" on public.training_applications
  for select to authenticated using (
    applicant_user_id = auth.uid()
    or exists (select 1 from public.training_programs p where p.id = training_id and p.created_by = auth.uid())
  );

drop policy if exists "training applications applicant insert" on public.training_applications;
create policy "training applications applicant insert" on public.training_applications
  for insert to authenticated with check (applicant_user_id = auth.uid());

drop policy if exists "training experiences public read" on public.training_experiences;
create policy "training experiences public read" on public.training_experiences
  for select to anon, authenticated using (true);

drop policy if exists "training experiences owner insert" on public.training_experiences;
create policy "training experiences owner insert" on public.training_experiences
  for insert to authenticated with check (
    exists (select 1 from public.worker_profiles w where w.id = worker_id and w.user_id = auth.uid())
  );

create or replace function public.apply_training(_training_id uuid, _note text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare p record; w record; aid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select * into p from public.training_programs where id=_training_id and status='published' and is_demo=false;
  if not found then raise exception 'Training program is not available' using errcode='P0002'; end if;
  select * into w from public.worker_profiles where user_id=auth.uid() and is_demo=false limit 1;
  if not found then raise exception 'Complete your worker profile before applying' using errcode='42501'; end if;
  if exists (select 1 from public.training_applications where training_id=_training_id and applicant_user_id=auth.uid() and status not in ('declined')) then
    raise exception 'You already have an application for this training' using errcode='23505';
  end if;
  insert into public.training_applications(training_id, applicant_user_id, worker_id, note)
  values (_training_id, auth.uid(), w.id, left(btrim(coalesce(_note,'')),2000))
  on conflict (training_id, applicant_user_id) do update
    set worker_id=excluded.worker_id,status='applied',note=excluded.note,applied_at=now(),updated_at=now(),shortlisted_at=null,accepted_at=null,completed_at=null
  returning id into aid;
  insert into public.notifications(user_id,kind,text,link) values(p.created_by,'training_application','New training application: ' || p.title,'/training');
  return aid;
end;
$$;

create or replace function public.shortlist_training_application(_application_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare a record;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select a.*, p.title, p.created_by into a
  from public.training_applications a join public.training_programs p on p.id=a.training_id
  where a.id=_application_id for update;
  if not found then raise exception 'Training application not found' using errcode='P0002'; end if;
  if a.created_by <> auth.uid() then raise exception 'Only the training provider can shortlist applicants' using errcode='42501'; end if;
  if a.status <> 'applied' then raise exception 'Only applied candidates can be shortlisted'; end if;
  update public.training_applications set status='shortlisted',shortlisted_at=now(),updated_at=now() where id=a.id;
  insert into public.notifications(user_id,kind,text,link) values(a.applicant_user_id,'training_shortlisted','You were shortlisted for: ' || a.title,'/training');
  return 'shortlisted';
end;
$$;

create or replace function public.respond_training_application(_application_id uuid,_accept boolean,_note text default null)
returns text language plpgsql security definer set search_path = public
as $$
declare a record;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select a.*, p.title, p.created_by into a
  from public.training_applications a join public.training_programs p on p.id=a.training_id
  where a.id=_application_id for update;
  if not found then raise exception 'Training application not found' using errcode='P0002'; end if;
  if a.applicant_user_id <> auth.uid() then raise exception 'Only the applicant can respond' using errcode='42501'; end if;
  if a.status <> 'shortlisted' then raise exception 'This training application is not awaiting your response'; end if;
  if _accept then
    update public.training_applications set status='accepted',accepted_at=now(),note=case when nullif(btrim(coalesce(_note,'')),'') is null then note else left(btrim(_note),2000) end,updated_at=now() where id=a.id;
    insert into public.notifications(user_id,kind,text,link) values(a.created_by,'training_accepted','Training candidate accepted: ' || a.title,'/training');
    return 'accepted';
  end if;
  update public.training_applications set status='declined',note=case when nullif(btrim(coalesce(_note,'')),'') is null then note else left(btrim(_note),2000) end,updated_at=now() where id=a.id;
  insert into public.notifications(user_id,kind,text,link) values(a.created_by,'training_declined','Training candidate declined: ' || a.title,'/training');
  return 'declined';
end;
$$;

create or replace function public.complete_training_application(_application_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare a record;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select a.*, p.title, p.description, p.created_by into a
  from public.training_applications a join public.training_programs p on p.id=a.training_id
  where a.id=_application_id for update;
  if not found then raise exception 'Training application not found' using errcode='P0002'; end if;
  if a.applicant_user_id <> auth.uid() and a.created_by <> auth.uid() then raise exception 'Only the learner or training provider can complete this training' using errcode='42501'; end if;
  if a.status <> 'accepted' then raise exception 'Only accepted training can be completed'; end if;
  update public.training_applications set status='completed',completed_at=now(),updated_at=now() where id=a.id;
  insert into public.training_experiences(training_id,worker_id,provider_user_id,title,description,completed_at)
  values(a.training_id,a.worker_id,a.created_by,a.title,a.description,now())
  on conflict (training_id,worker_id) do update set title=excluded.title,description=excluded.description,provider_user_id=excluded.provider_user_id,completed_at=excluded.completed_at;
  insert into public.notifications(user_id,kind,text,link)
  values(case when auth.uid()=a.applicant_user_id then a.created_by else a.applicant_user_id end,'training_completed','Training completed: ' || a.title,'/training');
  return 'completed';
end;
$$;

grant execute on function public.apply_training(uuid,text) to authenticated;
grant execute on function public.shortlist_training_application(uuid) to authenticated;
grant execute on function public.respond_training_application(uuid,boolean,text) to authenticated;
grant execute on function public.complete_training_application(uuid) to authenticated;

create or replace function public.notify_milestone_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare cp uuid; c record;
begin
  select * into c from public.contracts where id=coalesce(new.contract_id,old.contract_id);
  if not found then return coalesce(new,old); end if;
  cp := public.contract_counterparty_user(c.id);
  if tg_op='DELETE' then
    if cp is not null then insert into public.notifications(user_id,kind,text,link) values(cp,'milestone_deleted','Milestone deleted: ' || old.title,'/dashboard'); end if;
    return old;
  end if;
  if tg_op='UPDATE' and (
    old.sequence is distinct from new.sequence or old.title is distinct from new.title or old.description is distinct from new.description or
    old.amount_rwf is distinct from new.amount_rwf or old.due_date is distinct from new.due_date
  ) and cp is not null then
    insert into public.notifications(user_id,kind,text,link) values(cp,'milestone_updated','Milestone updated: ' || new.title,'/dashboard');
  end if;
  return new;
end;
$$;

drop trigger if exists milestones_notify_change on public.milestones;
create trigger milestones_notify_change after update or delete on public.milestones
for each row execute function public.notify_milestone_change();
