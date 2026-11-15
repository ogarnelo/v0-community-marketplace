-- READ ONLY preflight. No mutations or production grants.
-- The production policy listing_photos_select_public refers to listings.
-- Revoking anon SELECT on listings may invalidate direct anon photo reads.
BEGIN READ ONLY;
SELECT tablename,policyname,cmd,roles,
  (qual ILIKE '%listings%') AS refers_to_listings
FROM pg_policies
WHERE schemaname='public' AND tablename='listing_photos' AND cmd='SELECT';
SELECT has_table_privilege('anon','public.listings','SELECT') AS anon_listings_select,
       has_table_privilege('anon','public.listing_photos','SELECT') AS anon_photos_select;
ROLLBACK;
