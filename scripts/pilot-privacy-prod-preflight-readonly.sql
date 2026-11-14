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
ROLLBACK;
