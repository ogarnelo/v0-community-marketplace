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
 has_table_privilege('anon','public.listings','INSERT') AS anon_insert,
 has_table_privilege('anon','public.listings','UPDATE') AS anon_update,
 has_table_privilege('anon','public.listings','DELETE') AS anon_delete,
 has_any_column_privilege('anon','public.listings','INSERT') AS anon_insert_columnwise,
 has_any_column_privilege('anon','public.listings','UPDATE') AS anon_update_columnwise,
 CASE WHEN has_table_privilege('anon','public.listings','INSERT')
    OR has_table_privilege('anon','public.listings','UPDATE')
    OR has_table_privilege('anon','public.listings','DELETE')
    OR has_any_column_privilege('anon','public.listings','INSERT')
    OR has_any_column_privilege('anon','public.listings','UPDATE')
 THEN 'NO_GO_ANON_DML_GRANTS'
 ELSE 'PASS_ANON_DML_GRANTS_REVOKED' END AS anon_dml_gate,
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

-- Fail-closed *catalog signature* for chat privacy, not proof of every
-- effective RLS path. Existing production SELECT policies are member-scoped.
WITH chat_tables(table_name) AS (
 VALUES ('conversations'), ('messages')
), privacy AS (
 SELECT c.table_name,
   t.relrowsecurity AS rls_enabled,
   has_table_privilege('anon',t.oid,'SELECT') AS anon_table_read,
   has_table_privilege('authenticated',t.oid,'SELECT') AS auth_table_read,
   EXISTS (
     SELECT 1 FROM pg_policies p
     WHERE p.schemaname='public' AND p.tablename=c.table_name
     AND p.cmd='SELECT' AND 'authenticated'=ANY(p.roles)
     AND p.qual ILIKE '%auth.uid%'
     AND (c.table_name<>'conversations'
          OR (p.qual ILIKE '%buyer_id%' AND p.qual ILIKE '%seller_id%'))
     AND (c.table_name<>'messages'
          OR (p.qual ILIKE '%conversations%' AND p.qual ILIKE '%buyer_id%'
              AND p.qual ILIKE '%seller_id%'))
   ) AS member_scoped_policy
 FROM chat_tables c
 LEFT JOIN pg_class t ON t.oid=to_regclass('public.'||c.table_name)
)
SELECT table_name,rls_enabled,anon_table_read,auth_table_read,member_scoped_policy,
 CASE WHEN rls_enabled IS TRUE AND anon_table_read IS FALSE
     AND auth_table_read IS TRUE AND member_scoped_policy IS TRUE
   THEN 'PASS_CHAT_RLS_CATALOG'
   ELSE 'NO_GO_CHAT_RLS_CATALOG' END AS gate
FROM privacy ORDER BY table_name;

-- Diagnostic only: has_any_column_privilege also returns true for a TABLE grant.
-- Distinguish explicitly recorded per-column ACL entries from effective rights.
-- Direct anon/PUBLIC column ACL counts do NOT audit inherited grants from other roles.
SELECT
 count(*) FILTER (WHERE grants.privilege_type='INSERT'
     AND grants.grantee IN (0,(SELECT oid FROM pg_roles WHERE rolname='anon')))::int
   AS direct_anon_public_column_insert_grants,
 count(*) FILTER (WHERE grants.privilege_type='UPDATE'
     AND grants.grantee IN (0,(SELECT oid FROM pg_roles WHERE rolname='anon')))::int
   AS direct_anon_public_column_update_grants
FROM pg_attribute a
LEFT JOIN LATERAL aclexplode(a.attacl) AS grants ON true
WHERE a.attrelid='public.listings'::regclass
  AND a.attnum>0 AND NOT a.attisdropped;


-- P0 catalog-only guard against accidental admin-role escalation.
-- RLS policy signatures are necessary but not sufficient: E2E with an unprivileged
-- authenticated account must still attempt INSERT/UPDATE/DELETE in user_roles.
WITH policy_flags AS (
 SELECT
   bool_or(cmd='INSERT' AND 'authenticated'=ANY(roles)
     AND with_check ILIKE '%is_superadmin%') AS admin_insert_only,
   bool_or(cmd='UPDATE' AND 'authenticated'=ANY(roles)
     AND qual ILIKE '%is_superadmin%'
     AND with_check ILIKE '%is_superadmin%') AS admin_update_only,
   bool_or(cmd='DELETE' AND 'authenticated'=ANY(roles)
     AND qual ILIKE '%is_superadmin%') AS admin_delete_only
 FROM pg_policies
 WHERE schemaname='public' AND tablename='user_roles'
), helper AS (
 SELECT
   p.prosecdef AS private_security_definer,
   pg_get_functiondef(p.oid) ILIKE '%auth.uid()%' AS private_uid_check,
   pg_get_functiondef(p.oid) ILIKE '%super_admin%' AS private_role_check,
   has_function_privilege('anon',p.oid,'EXECUTE') AS private_anon_execute
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname='is_superadmin'
   AND pg_get_function_identity_arguments(p.oid)=''
), wrapper AS (
 SELECT
   (NOT p.prosecdef) AS public_security_invoker,
   has_function_privilege('anon',p.oid,'EXECUTE') AS public_anon_execute,
   has_function_privilege('authenticated',p.oid,'EXECUTE') AS public_auth_execute
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='is_superadmin'
   AND pg_get_function_identity_arguments(p.oid)=''
)
SELECT
 COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.user_roles')),false) AS rls_enabled,
 COALESCE((SELECT admin_insert_only FROM policy_flags),false) AS admin_insert_only,
 COALESCE((SELECT admin_update_only FROM policy_flags),false) AS admin_update_only,
 COALESCE((SELECT admin_delete_only FROM policy_flags),false) AS admin_delete_only,
 CASE WHEN COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.user_roles')),false)
   AND COALESCE((SELECT admin_insert_only FROM policy_flags),false)
   AND COALESCE((SELECT admin_update_only FROM policy_flags),false)
   AND COALESCE((SELECT admin_delete_only FROM policy_flags),false)
   AND COALESCE((SELECT private_security_definer FROM helper),false)
   AND COALESCE((SELECT private_uid_check FROM helper),false)
   AND COALESCE((SELECT private_role_check FROM helper),false)
   AND COALESCE((SELECT NOT private_anon_execute FROM helper),false)
   AND COALESCE((SELECT public_security_invoker FROM wrapper),false)
   AND COALESCE((SELECT NOT public_anon_execute FROM wrapper),false)
   AND COALESCE((SELECT public_auth_execute FROM wrapper),false)
 THEN 'PASS_ADMIN_RLS_CATALOG_NEEDS_E2E'
 ELSE 'NO_GO_ADMIN_ROLE_ESCALATION_CATALOG' END AS admin_role_gate;

ROLLBACK;
