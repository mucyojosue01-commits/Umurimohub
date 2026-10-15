-- Rank company discovery by trust first, then score; proximity is a client-side secondary sort.
create or replace function public.search_businesses(
  _q text default null,
  _sector text default null,
  _district text default null,
  _verified boolean default null,
  _limit integer default 24,
  _offset integer default 0
)
returns table(
  id text,
  name text,
  sector text,
  district text,
  verified boolean,
  rating numeric,
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
  order by f.verified desc nulls last, f.rating desc nulls last, lower(f.name), f.id
  limit least(greatest(coalesce(_limit, 24), 1), 100)
  offset greatest(coalesce(_offset, 0), 0)
$function$;

revoke all on function public.search_businesses(text, text, text, boolean, integer, integer) from public;
grant execute on function public.search_businesses(text, text, text, boolean, integer, integer) to anon, authenticated;
