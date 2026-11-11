-- WETUDY pilot P0 #375 — read-only audit of intentional deny-only tables.
-- Six internal tables must remain RLS-enabled, without public-facing policies
-- or ordinary DML grants to the anon/authenticated Data API roles.
-- This is detection evidence ONLY; not permission to alter any policies.
BEGIN TRANSACTION READ ONLY;
WITH scope(table_name) AS (
  VALUES ('marketplace_alert_outbox'),('marketplace_postal_centroids'),
    ('school_directory'),('school_impact_report_deliveries'),
    ('school_impact_report_subscriptions'),('super_admin_report_subscriptions')
), roles(role_name) AS (VALUES ('anon'),('authenticated')),
client_privileges(privilege_name) AS (
  VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE')
), examined AS (
 SELECT s.table_name, r.role_name, p.privilege_name,
    c.oid IS NOT NULL AS table_exists,
    coalesce(c.relrowsecurity,false) AS rls_enabled,
    (SELECT count(*)::int FROM pg_policies pol WHERE
       pol.schemaname='public' AND pol.tablename=s.table_name) AS policy_count,
    CASE WHEN c.oid IS NULL THEN true
      ELSE has_table_privilege(r.role_name,c.oid,p.privilege_name)
    END AS effective_client_grant
 FROM scope s CROSS JOIN roles r CROSS JOIN client_privileges p
 LEFT JOIN pg_class c ON c.relname=s.table_name
  AND c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
)
SELECT
  count(*)::int AS checked_cells,
  count(*) FILTER (WHERE NOT table_exists)::int AS missing_table_cells,
  count(*) FILTER (WHERE NOT rls_enabled)::int AS rls_disabled_cells,
  count(*) FILTER (WHERE policy_count != 0)::int AS unexpected_policy_cells,
  count(*) FILTER (WHERE effective_client_grant)::int AS effective_client_grant_cells,
  bool_and(table_exists AND rls_enabled AND policy_count=0
           AND NOT effective_client_grant) AS deny_only_guard_pass
FROM examined;
COMMIT;
