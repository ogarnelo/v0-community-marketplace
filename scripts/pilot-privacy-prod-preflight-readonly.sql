-- WETUDY privacy P0 - production PREFLIGHT READ ONLY.
-- Collect metadata only. Never use this file to change grants.
BEGIN TRANSACTION READ ONLY;
WITH acl AS (
 SELECT attname,
   has_column_privilege('anon','public.listings',attname,'SELECT') AS a,
   has_column_privilege('authenticated','public.listings',attname,'SELECT') AS u
 FROM pg_attribute WHERE attrelid='public.listings'::regclass
   AND attnum>0 AND NOT attisdropped
), counted AS (
 SELECT count(*)::int AS total_columns,
 count(*) FILTER (WHERE a)::int AS anon_readable_columns,
 count(*) FILTER (WHERE u)::int AS auth_readable_columns,
 count(*) FILTER (WHERE a AND attname IN
 ('postal_code','lat','lng','seller_id','user_id'))::int AS anon_sensitive_columns,
 count(*) FILTER (WHERE u AND attname IN
 ('postal_code','lat','lng'))::int AS auth_sensitive_location_columns
 FROM acl
)
SELECT counted.*,
 has_table_privilege('anon','public.listings','SELECT') AS anon_tablewide_select,
 has_table_privilege('authenticated','public.listings','SELECT') AS auth_tablewide_select,
 has_table_privilege('service_role','public.listings','SELECT') AS service_tablewide_select,
 has_table_privilege('authenticated','public.listings','INSERT') AS auth_insert,
 has_table_privilege('authenticated','public.listings','UPDATE') AS auth_update,
 has_table_privilege('authenticated','public.listings','DELETE') AS auth_delete,
 CASE WHEN anon_readable_columns>0 OR auth_sensitive_location_columns>0
 THEN 'NO_GO_PRIVACY'
 ELSE 'CATALOG_PASS_NEEDS_API_E2E' END AS privacy_gate
FROM counted;

SELECT t.relname AS table_name, t.relrowsecurity AS rls_enabled,
 count(p.policyname) FILTER(WHERE p.cmd='SELECT') AS select_policies,
 has_table_privilege('anon',t.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',t.oid,'SELECT') AS authenticated_select
FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
LEFT JOIN pg_policies p ON p.schemaname=n.nspname AND p.tablename=t.relname
WHERE n.nspname='public' AND t.relname IN ('listings','listing_photos')
GROUP BY t.oid,t.relname,t.relrowsecurity ORDER BY t.relname;

SELECT policyname,cmd,(qual ILIKE '%listings%') AS references_listings
FROM pg_policies WHERE schemaname='public' AND tablename='listing_photos';
SELECT EXISTS(SELECT 1 FROM pg_publication_tables
 WHERE schemaname='public' AND tablename='listings')
 AS realtime_listing_published;
-- The server calls postal-distance RPCs using service_role only.
-- Prevent a future direct Data API call from selecting an arbitrary viewer CP.
WITH expected(fn) AS (
 VALUES ('marketplace_nearest_listing_page_v1'),
        ('marketplace_nearby_listing_page_v1')
), actual AS (
 SELECT e.fn, p.oid, p.prosecdef,
   COALESCE(has_function_privilege('anon',p.oid,'EXECUTE'),false) AS anon_exec,
   COALESCE(has_function_privilege('authenticated',p.oid,'EXECUTE'),false) AS auth_exec,
   COALESCE(has_function_privilege('service_role',p.oid,'EXECUTE'),false) AS server_exec
 FROM expected e
 LEFT JOIN pg_proc p ON p.proname=e.fn
   AND p.pronamespace='public'::regnamespace
)
SELECT fn,anon_exec,auth_exec,server_exec,
       CASE WHEN oid IS NULL OR prosecdef IS DISTINCT FROM false
          OR anon_exec OR auth_exec OR NOT server_exec
        THEN 'NO_GO_GEO_RPC'
        ELSE 'PASS_GEO_RPC_SERVER_ONLY' END AS gate
FROM actual ORDER BY fn;
SELECT has_table_privilege('anon','public.marketplace_postal_centroids','SELECT')
  AS anon_centroid_select,
 has_table_privilege('authenticated','public.marketplace_postal_centroids','SELECT')
  AS auth_centroid_select,
 CASE WHEN has_table_privilege('anon','public.marketplace_postal_centroids','SELECT')
        OR has_table_privilege('authenticated','public.marketplace_postal_centroids','SELECT')
      THEN 'NO_GO_POSTAL_CENTROIDS' ELSE 'PASS_POSTAL_CENTROIDS_PRIVATE' END AS gate;

ROLLBACK;
