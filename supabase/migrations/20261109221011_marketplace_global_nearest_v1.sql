-- Global 'Más cercanos' ordering without a radius.
-- Includes available listings with UNKNOWN postal location after geolocated ones.
-- No synthetic listings are inserted; this migration only creates an internal RPC.
create or replace function public.marketplace_nearest_listing_page_v1(
  p_postal_code text,
  p_radius_km integer default null,
  p_query text default '',
  p_isbn text default '',
  p_category text default '',
  p_grade_level text default '',
  p_listing_type text default '',
  p_condition text default '',
  p_since timestamptz default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_sort text default 'newest',
  p_offset integer default 0,
  p_page_size integer default 61
)
returns table (listing_id uuid, distance_km double precision)
language sql stable security invoker
set search_path = ''
as $$
  select l.id as listing_id,
    round((extensions.st_distance(candidate.location, viewer.location, false) / 1000)::numeric, 1)::double precision as distance_km
  from public.marketplace_postal_centroids viewer
  join public.listings l on l.status = 'available'
  left join public.profiles seller
    on seller.id = coalesce(l.seller_id, l.user_id)
  left join public.marketplace_postal_centroids candidate
    on candidate.postal_code =
      coalesce(nullif(seller.postal_code, ''), nullif(l.postal_code, ''))
  where viewer.postal_code = p_postal_code
    and p_radius_km is null
    and p_sort = 'distance'
    and p_offset between 0 and 999999
    and p_page_size between 1 and 61
    and (p_category = '' or l.category = p_category)
    and (p_grade_level = '' or l.grade_level = p_grade_level)
    and (p_listing_type = '' or l.type = p_listing_type)
    and (p_condition = '' or l.condition = p_condition)
    and (p_isbn = '' or l.isbn ilike '%' || p_isbn || '%')
    and (p_since is null or l.created_at >= p_since)
    and ((p_price_min is null and p_price_max is null)
      or l.type = 'donation'
      or (l.price >= coalesce(p_price_min, 0)
        and (p_price_max is null or l.price <= p_price_max)))
    and (p_query = '' or (
      l.title ilike '%' || p_query || '%' or
      l.description ilike '%' || p_query || '%' or
      l.category ilike '%' || p_query || '%' or
      l.grade_level ilike '%' || p_query || '%' or
      l.isbn ilike '%' || p_query || '%' or
      l.author ilike '%' || p_query || '%' or
      l.publisher ilike '%' || p_query || '%' or
      l.format ilike '%' || p_query || '%' or
      l.language ilike '%' || p_query || '%' or
      l.subject ilike '%' || p_query || '%' or
      l.specific_type ilike '%' || p_query || '%' or
      l.size_label ilike '%' || p_query || '%' or
      l.brand ilike '%' || p_query || '%' or
      l.model ilike '%' || p_query || '%' or
      l.season ilike '%' || p_query || '%'
    ))
  order by
    extensions.st_distance(candidate.location, viewer.location, false) asc nulls last,
    l.created_at desc nulls last,
    l.id desc
  limit least(p_page_size, 61) offset p_offset;
$$;
revoke all on function public.marketplace_nearest_listing_page_v1(text,integer,text,text,text,text,text,text,timestamptz,numeric,numeric,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.marketplace_nearest_listing_page_v1(text,integer,text,text,text,text,text,text,timestamptz,numeric,numeric,text,integer,integer)
  to service_role;
