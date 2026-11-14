-- WETUDY P0 / 14 Nov 2026 / READ-ONLY metadata only, no user rows or secrets.
-- Scope: anonymous direct SQL/Data API capability. Feed response privacy is a separate gate.
-- Run on the authorized project; never mutate privileges in production here.
BEGIN TRANSACTION READ ONLY;

WITH a AS (
  SELECT attname,
    has_column_privilege('anon','public.listings',attname,'SELECT') AS anon_read
  FROM pg_attribute
  WHERE attrelid='public.listings'::regclass
    AND attnum>0 AND NOT attisdropped
)
SELECT count(*) AS total_listing_columns,
       count(*) FILTER (WHERE anon_read) AS anon_selectable_columns,
       has_table_privilege('anon','public.listings','SELECT') AS anon_tablewide_select,
       count(*) FILTER (WHERE anon_read AND attname IN
         ('postal_code','lat','lng','seller_id','user_id')) AS sensitive_columns_exposed,
       CASE WHEN has_table_privilege('anon','public.listings','SELECT')
           OR bool_or(anon_read AND attname IN ('postal_code','lat','lng','seller_id','user_id'))
         THEN 'NO_GO_PRIVACY_REVIEW'
         ELSE 'PASS_CATALOG_ONLY_REQUIRES_API_QA' END AS gate
FROM a;

-- Evidence-only per-column visibility. No values are selected from listings.
SELECT attname AS column_name,
       has_column_privilege('anon','public.listings',attname,'SELECT') AS anon_can_select
FROM pg_attribute
WHERE attrelid='public.listings'::regclass
  AND attnum>0 AND NOT attisdropped
  AND attname IN ('postal_code','lat','lng','seller_id','user_id')
ORDER BY attname;

ROLLBACK;
-- Even a PASS requires Data API, views, RPC and client/SSR regression tests.
-- Do NOT revoke tablewide SELECT without mapping consumers and preserving radio,
-- listing detail, favorites, messaging, photos and infinite scrolling.
