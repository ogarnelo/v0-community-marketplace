-- The optimized RPC must return the SAME id, rounded distance, order
-- and filters as the original for every selected scenario.
do $$
declare
  mismatch_count integer;
begin
  with cases as (
  select * from (values
    ('radius10', 10, 'distance', '', ''),
    ('radius50', 50, 'newest', '', ''),
    ('radius200', 200, 'distance', '', ''),
    ('category', 200, 'discount', '', 'Uniformes'),
    ('text', 200, 'price_asc', 'Polo', '')
  ) c(test_name, radius_km, sorting, search_term, category)
  ), actual as (
  select c.test_name, x.position, x.listing_id, x.distance_km
  from cases c
  cross join lateral public.marketplace_nearby_listing_page_v1(
    p_postal_code => '28001',
    p_radius_km => c.radius_km,
    p_sort => c.sorting,
    p_query => c.search_term,
    p_category => c.category,
    p_page_size => 61
  ) with ordinality as x(listing_id, distance_km, position)
  ), differences as (
    (select * from public.qa_geo_expected except all select * from actual)
    union all
    (select * from actual except all select * from public.qa_geo_expected)
  )
  select count(*) into mismatch_count from differences;
  if mismatch_count > 0 then
    raise exception 'Geosearch optimized query changed % rows/order/filter results',
      mismatch_count;
  end if;
  raise notice 'Geosearch equivalence passed for all five scenarios';
end $$;
