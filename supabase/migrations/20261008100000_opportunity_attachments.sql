create table if not exists public.opportunity_attachments (
 id uuid primary key default gen_random_uuid(),
 opportunity_id text not null references public.opportunities(id) on delete cascade,
 uploaded_by uuid not null,
 storage_path text not null,
 file_name text not null,
 mime_type text not null,
 size_bytes bigint not null check (size_bytes > 0),
 created_at timestamptz not null default now()
);
create index if not exists opportunity_attachments_opportunity_idx on public.opportunity_attachments(opportunity_id,created_at);
alter table public.opportunity_attachments enable row level security;
grant select,insert,delete on public.opportunity_attachments to authenticated;
drop policy if exists "attachments public read for published opportunities" on public.opportunity_attachments;
create policy "attachments public read for published opportunities" on public.opportunity_attachments for select to authenticated using (
 exists(select 1 from public.opportunities o where o.id=opportunity_attachments.opportunity_id and o.status<>'draft')
);
drop policy if exists "attachments business upload" on public.opportunity_attachments;
create policy "attachments business upload" on public.opportunity_attachments for insert to authenticated with check (
 uploaded_by=auth.uid() and exists(select 1 from public.opportunities o where o.id=opportunity_attachments.opportunity_id and public.is_business_member(o.business_id) and o.created_by=auth.uid())
);
drop policy if exists "attachments uploader delete" on public.opportunity_attachments;
create policy "attachments uploader delete" on public.opportunity_attachments for delete to authenticated using(uploaded_by=auth.uid());
insert into storage.buckets(id,name,public) values ('opportunity-attachments','opportunity-attachments',false) on conflict(id) do nothing;
drop policy if exists "opportunity attachments storage read" on storage.objects;
create policy "opportunity attachments storage read" on storage.objects for select to authenticated using(bucket_id='opportunity-attachments' and exists(select 1 from public.opportunity_attachments a where a.storage_path=name));
drop policy if exists "opportunity attachments storage upload" on storage.objects;
create policy "opportunity attachments storage upload" on storage.objects for insert to authenticated with check(bucket_id='opportunity-attachments' and owner_id=auth.uid()::text);
drop policy if exists "opportunity attachments storage delete" on storage.objects;
create policy "opportunity attachments storage delete" on storage.objects for delete to authenticated using(bucket_id='opportunity-attachments' and owner_id=auth.uid()::text);