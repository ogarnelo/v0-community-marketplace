-- WETUDY | P0 #375 | non-mutating ACL evidence before/after hardening.
-- This records DIRECT grants and effective privileges separately. Run before
-- any migration and archive the output in the restricted operations log.
-- DO NOT use a blind GRANT ALL as rollback: the baseline may be sparse.
BEGIN TRANSACTION READ ONLY;

WITH scope(t) AS (
  VALUES
    ('saved_searches'),('saved_search_matches'),('user_marketplace_preferences'),
    ('profiles'),('listings'),('listing_photos'),('schools'),('school_codes'),
    ('school_access_codes'),('user_roles'),('notifications')
),
client_roles(role_name) AS (VALUES ('anon'),('authenticated')),
privileges(privilege_name) AS (
  VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
         ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')
),
catalog AS (
  SELECT s.t, c.oid, c.relacl, c.relowner
  FROM scope s LEFT JOIN pg_class c ON c.relname=s.t
    AND c.relnamespace='public'::regnamespace
    AND c.relkind IN ('r','p')
)
SELECT 'scope' AS evidence, count(*)::int AS scope_tables,
       count(oid)::int AS present_tables,
       (count(oid)=11) AS all_expected_present
FROM catalog;

WITH scope(t) AS (
  VALUES
    ('saved_searches'),('saved_search_matches'),('user_marketplace_preferences'),
    ('profiles'),('listings'),('listing_photos'),('schools'),('school_codes'),
    ('school_access_codes'),('user_roles'),('notifications')
),
client_roles(role_name) AS (VALUES ('anon'),('authenticated')),
privileges(privilege_name) AS (
  VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
         ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')
)
SELECT c.relname AS table_name,
       client_roles.role_name AS grantee_role,
       privileges.privilege_name,
       has_table_privilege(client_roles.role_name,c.oid,privileges.privilege_name)
         AS effective_privilege,
       count(a.grantor)::int AS direct_grant_count,
       coalesce(string_agg(DISTINCT a.grantor::regrole::text,','
         ORDER BY a.grantor::regrole::text),'') AS direct_grantors,
       coalesce(bool_or(a.is_grantable),false) AS direct_grant_option
FROM scope s JOIN pg_class c ON c.relname=s.t
  AND c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
CROSS JOIN client_roles CROSS JOIN privileges
LEFT JOIN LATERAL aclexplode(c.relacl) a
  ON a.grantee=(SELECT oid FROM pg_roles WHERE rolname=client_roles.role_name)
  AND a.privilege_type=privileges.privilege_name
GROUP BY c.relname,c.oid,client_roles.role_name,privileges.privilege_name
ORDER BY c.relname,client_roles.role_name,privileges.privilege_name;

-- Caller must preserve BOTH result sets, their execution time, migration
-- hash and the roles/grantors. An effective grant can be inherited via
-- PUBLIC/role membership even if direct_grant_count = 0.
COMMIT;
