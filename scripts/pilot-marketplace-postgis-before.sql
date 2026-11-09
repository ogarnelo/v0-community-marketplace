-- Disposable CI only. Capture exact first-page results for five scenarios.
-- No production table is touched; qa_geo_expected exists only in the runner.
create table public.qa_geo_expected as
with cases as (
  select * from (values
    ('radius10', 10, 'distance', '', ''),
    ('radius50', 50, 'newest', '', ''),
    ('radius200', 200, 'distance', '', ''),
    ('category', 200, 'discount', '', 'Uniformes'),
    ('text', 200, 'price_asc', 'Polo', '')
  ) c(test_name, radius_km, sorting, search_term, category)
)
  select c.test_name, x.position, x.listing_id, x.distance_km
  from cases c
  cross join lateral public.marketplace_nearby_listing_page_v1(
    p_postal_code => '28001',
    p_radius_km => c.radius_km,
    p_sort => c.sorting,
    p_query => c.search_term,
    p_category => c.category,
    p_page_size => 61
  ) with ordinality as x(listing_id, distance_km, position);
select test_name,count(*) as rows_before
from public.qa_geo_expected group by test_name order by test_name;
