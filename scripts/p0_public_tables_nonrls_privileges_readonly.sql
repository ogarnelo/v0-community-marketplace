-- WETUDY P0 READ ONLY: all public table-wide non-RLS grants.
-- Counts report effective privileges, not possible direct SQL exploitability.
BEGIN TRANSACTION READ ONLY;
WITH t AS (
 SELECT oid,relname,relrowsecurity FROM pg_class
 WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p')
), r(role_name) AS (VALUES ('anon'),('authenticated')),
p(privilege) AS (VALUES ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN'))
SELECT t.relname AS table_name,r.role_name,t.relrowsecurity AS rls_on,
 string_agg(p.privilege,',' ORDER BY p.privilege)
 FILTER(WHERE has_table_privilege(r.role_name,t.oid,p.privilege)) AS exposed_privileges
FROM t CROSS JOIN r CROSS JOIN p GROUP BY t.relname,r.role_name,t.relrowsecurity
ORDER BY t.relname,r.role_name;
ROLLBACK;
