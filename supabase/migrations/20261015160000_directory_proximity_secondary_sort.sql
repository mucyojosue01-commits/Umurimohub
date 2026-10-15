-- Trust score is the primary ranking signal. Within comparable trust scores,
-- prioritize the user's district before using public ratings as the next tie-breaker.
-- The schema stores district/work-area text rather than precise coordinates, so this
-- uses the best available location signal without inventing distances.

create or replace function public.search_businesses(
  _q text default null,
  _sector text default null,
  _district text default null,
  _verified boolean default null,
  _limit integer default 30,
  _offset integer default 0,
  _preferred_district text default null
)
returns table(
  id text,
  name text,
  sector text,
  district text,
  verified boolean,
  rating numeric,
  trust_score numeric,
  about text,
  avatar_url text,
  open_count bigint,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $function$
  with filtered_businesses as (
    select b.*
    from public.businesses b
    where (
      nullif(trim(_q), '') is null
      or b.name ilike '%' || trim(_q) || '%'
      or coalesce(b.about, '') ilike '%' || trim(_q) || '%'
      or coalesce(array_to_string(b.services, ' '), '') ilike '%' || trim(_q) || '%'
    )
    and (nullif(trim(_sector), '') is null or b.sector = _sector)
    and (nullif(trim(_district), '') is null or b.district = _district)
    and (_verified is null or b.verified = _verified)
  )
  select
    f.id,
    f.name,
    f.sector,
    f.district,
    f.verified,
    f.rating,
    f.trust_score,
    f.about,
    f.avatar_url,
    (
      select count(*)
      from public.opportunities o
      where o.business_id = f.id
        and o.status = 'open'
        and (o.deadline is null or o.deadline >= current_date)
    ) as open_count,
    count(*) over() as total_count
  from filtered_businesses f
  order by
    f.trust_score desc nulls last,
    (case
      when nullif(trim(_preferred_district), '') is not null
       and lower(coalesce(f.district, '')) = lower(trim(_preferred_district))
      then 1 else 0
    end) desc,
    f.rating desc nulls last,
    f.verified desc nulls last,
    lower(f.name),
    f.id
  limit least(greatest(coalesce(_limit, 30), 1), 30)
  offset greatest(coalesce(_offset, 0), 0)
$function$;

grant execute on function public.search_businesses(text, text, text, boolean, integer, integer, text) to anon, authenticated;

create or replace function public.search_teams(
  _q text default null,
  _sector text default null,
  _district text default null,
  _available boolean default null,
  _preferred_district text default null,
  _limit integer default 30
)
returns table(
  id text,
  name text,
  avatar_url text,
  trust_score numeric,
  lead_id text,
  sector text,
  areas text[],
  member_ids text[],
  rating numeric,
  projects integer,
  available boolean,
  summary text,
  skills text[],
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $function$
  with filtered_teams as (
    select t.*
    from public.teams t
    where coalesce(t.is_demo, false) = false
      and (
        nullif(trim(_q), '') is null
        or t.name ilike '%' || trim(_q) || '%'
        or coalesce(t.summary, '') ilike '%' || trim(_q) || '%'
        or coalesce(t.sector, '') ilike '%' || trim(_q) || '%'
        or coalesce(array_to_string(t.skills, ' '), '') ilike '%' || trim(_q) || '%'
        or coalesce(array_to_string(t.areas, ' '), '') ilike '%' || trim(_q) || '%'
      )
      and (nullif(trim(_sector), '') is null or t.sector = _sector)
      and (
        nullif(trim(_district), '') is null
        or exists (
          select 1 from unnest(coalesce(t.areas, '{}'::text[])) as area
          where lower(area) like '%' || lower(trim(_district)) || '%'
        )
      )
      and (_available is null or t.available = _available)
  )
  select
    t.id,
    t.name,
    t.avatar_url,
    t.trust_score,
    t.lead_worker_id as lead_id,
    t.sector,
    coalesce(t.areas, '{}'::text[]) as areas,
    coalesce(m.member_ids, '{}'::text[]) as member_ids,
    t.rating,
    t.projects,
    t.available,
    t.summary,
    coalesce(t.skills, '{}'::text[]) as skills,
    count(*) over() as total_count
  from filtered_teams t
  left join lateral (
    select array_agg(tm.worker_id order by tm.joined_at asc) filter (where tm.status = 'active') as member_ids
    from public.team_members tm
    where tm.team_id = t.id
  ) m on true
  order by
    t.trust_score desc nulls last,
    (case
      when nullif(trim(_preferred_district), '') is not null
       and exists (
         select 1 from unnest(coalesce(t.areas, '{}'::text[])) as area
         where lower(area) = lower(trim(_preferred_district))
       )
      then 1 else 0
    end) desc,
    t.rating desc nulls last,
    lower(t.name),
    t.id
  limit least(greatest(coalesce(_limit, 30), 1), 30)
$function$;

grant execute on function public.search_teams(text, text, text, boolean, text, integer) to anon, authenticated;
