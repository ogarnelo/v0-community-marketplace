-- WETUDY P0 cross-table ACL/RLS inventory. Metadata only, no row contents.
-- Effective table grants are NOT proof of RLS-bypass. Use API E2E for final GO.
BEGIN TRANSACTION READ ONLY;
WITH targets(table_name, sensitivity) AS (
 VALUES ('listings','P0_LOCATION'),('profiles','P0_PROFILE'),
 ('account_students','P0_STUDENT'),('conversations','P0_CHAT'),
 ('messages','P0_CHAT'),('favorites','PRIVATE_USER'),
 ('saved_searches','PRIVATE_USER'),('listing_photos','PUBLIC_MEDIA'),
 ('user_roles','PRIVATE_AUTHZ'),('schools','SCHOOL_DIRECTORY'),
 ('reports','PRIVATE_MODERATION'),('support_tickets','PRIVATE_SUPPORT')
), relations AS (
 SELECT t.*, c.oid, c.relrowsecurity,
   CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('anon',c.oid,'SELECT') END AS anon_select,
   CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('anon',c.oid,'INSERT') END AS anon_insert,
   CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('anon',c.oid,'UPDATE') END AS anon_update,
   CASE WHEN c.oid IS NULL THEN false ELSE has_table_privilege('anon',c.oid,'DELETE') END AS anon_delete
 FROM targets t LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||t.table_name)
), policy_summary AS (
 SELECT r.table_name,
   count(p.policyname) FILTER (WHERE p.cmd IN ('SELECT','ALL')
    AND ('public'=ANY(p.roles) OR 'anon'=ANY(p.roles)))::int AS anon_applicable_select_policies,
   count(p.policyname) FILTER (WHERE p.cmd IN ('INSERT','UPDATE','DELETE','ALL')
    AND ('public'=ANY(p.roles) OR 'anon'=ANY(p.roles)))::int AS anon_applicable_write_policies
 FROM relations r LEFT JOIN pg_policies p
 ON p.schemaname='public' AND p.tablename=r.table_name
 GROUP BY r.table_name
)
SELECT r.table_name, r.sensitivity,
  (r.oid IS NOT NULL) AS table_exists,
  COALESCE(r.relrowsecurity,false) AS rls_enabled,
  r.anon_select,r.anon_insert,r.anon_update,r.anon_delete,
  s.anon_applicable_select_policies,s.anon_applicable_write_policies,
  CASE
   WHEN r.oid IS NULL OR r.relrowsecurity IS NOT TRUE THEN 'NO_GO_MISSING_RLS'
   WHEN r.table_name='listings' AND r.anon_select THEN 'NO_GO_LISTINGS_ANON_SELECT'
   WHEN r.table_name IN ('conversations','messages','account_students','reports')
      AND (r.anon_select OR r.anon_insert OR r.anon_update OR r.anon_delete)
      THEN 'NO_GO_PRIVATE_TABLE_ANON_GRANT'
   WHEN r.anon_select AND s.anon_applicable_select_policies > 0
      THEN 'REVIEW_ANON_SELECT_RLS_POLICY'
   WHEN (r.anon_insert OR r.anon_update OR r.anon_delete)
       AND s.anon_applicable_write_policies > 0
      THEN 'REVIEW_ANON_WRITE_RLS_POLICY'
   WHEN r.anon_select OR r.anon_insert OR r.anon_update OR r.anon_delete
      THEN 'GRANT_EXISTS_RLS_POLICY_RESTRICTS_ANON'
   ELSE 'CATALOG_PASS_NEEDS_E2E' END AS catalog_gate
FROM relations r JOIN policy_summary s USING(table_name)
ORDER BY r.table_name;

-- Six intentionally server-only tables from Security Advisor INFO.
-- A new client SELECT grant would be a regression, not a fix for the INFO lint.
WITH server_only(name) AS (
 VALUES ('marketplace_alert_outbox'), ('marketplace_postal_centroids'),
 ('school_directory'), ('school_impact_report_deliveries'),
 ('school_impact_report_subscriptions'), ('super_admin_report_subscriptions')
)
SELECT name,
 c.relrowsecurity AS rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select,
 has_table_privilege('service_role',c.oid,'SELECT') AS service_select,
 CASE WHEN c.relrowsecurity IS TRUE
      AND NOT has_table_privilege('anon',c.oid,'SELECT')
      AND NOT has_table_privilege('authenticated',c.oid,'SELECT')
      AND has_table_privilege('service_role',c.oid,'SELECT')
      AND NOT EXISTS (SELECT 1 FROM pg_policies p
                      WHERE p.schemaname='public' AND p.tablename=server_only.name)
 THEN 'PASS_SERVER_ONLY_NO_POLICIES'
 ELSE 'NO_GO_SERVER_ONLY_GRANT_OR_POLICY_DRIFT' END AS server_only_gate
FROM server_only
LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||server_only.name)
ORDER BY name;

ROLLBACK;
