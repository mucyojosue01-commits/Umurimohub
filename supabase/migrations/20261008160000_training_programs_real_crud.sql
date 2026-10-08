create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  district text not null,
  provider_type text not null default 'business',
  status text not null default 'published',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists training_programs_creator_idx on public.training_programs(created_by);
create index if not exists training_programs_district_idx on public.training_programs(district);
alter table public.training_programs enable row level security;
drop policy if exists "training public read" on public.training_programs;
create policy "training public read" on public.training_programs for select to anon,authenticated using(status='published' and is_demo=false or created_by=auth.uid());
drop policy if exists "training creator insert" on public.training_programs;
create policy "training creator insert" on public.training_programs for insert to authenticated with check(created_by=auth.uid() and is_demo=false);
drop policy if exists "training creator update" on public.training_programs;
create policy "training creator update" on public.training_programs for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid() and is_demo=false);
drop policy if exists "training creator delete" on public.training_programs;
create policy "training creator delete" on public.training_programs for delete to authenticated using(created_by=auth.uid());