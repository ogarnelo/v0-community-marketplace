-- DISPOSABLE CI ONLY. Verify a listing CP is authoritative after a seller move.
-- Synthetic fixture: listing #1 is published at 28001 (Madrid);
-- seller #1 has changed their account postcode to 08001 (Barcelona).
do $$
declare
  madrid_count integer;
  barcelona_count integer;
  global_madrid_count integer;
  fallback_count integer;
begin
  select count(*) into madrid_count
    from public.marketplace_nearby_listing_page_v1(
      p_postal_code=>'28001',p_radius_km=>10,p_isbn=>'9780000000001');
  select count(*) into barcelona_count
    from public.marketplace_nearby_listing_page_v1(
      p_postal_code=>'08001',p_radius_km=>10,p_isbn=>'9780000000001');
  select count(*) into global_madrid_count
    from public.marketplace_nearest_listing_page_v1(
      p_postal_code=>'28001',p_sort=>'distance',p_isbn=>'9780000000001')
    where distance_km=0;
  -- Listing #3 has null postal_code and falls back to profile #3 (28901).
  select count(*) into fallback_count
    from public.marketplace_nearby_listing_page_v1(
      p_postal_code=>'28001',p_radius_km=>200,p_isbn=>'9780000000003');

  if madrid_count <> 1 or barcelona_count <> 0 or global_madrid_count <> 1 or fallback_count <> 1 then
    raise exception 'Geographic source mismatch: Madrid %, Barcelona %, global %, fallback %',
      madrid_count,barcelona_count,global_madrid_count,fallback_count;
  end if;
  raise notice 'CP precedence PASS: listing Madrid, seller Barcelona; fallback for legacy listing PASS';
end $$;
