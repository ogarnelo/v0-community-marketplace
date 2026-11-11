-- WETUDY: inventory of role privileges outside RLS, metadata only.
-- Never reads personal rows; no DDL, DML, privilege changes or job activation.
BEGIN TRANSACTION READ ONLY;

WITH tables AS MATERIALIZED (
  SELECT c.oid,c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
), grants AS (
  SELECT t.oid,t.relname,r.role_name,
    has_table_privilege(r.role_name,t.oid,'TRUNCATE') AS can_truncate,
    has_table_privilege(r.role_name,t.oid,'REFERENCES') AS can_references,
    has_table_privilege(r.role_name,t.oid,'TRIGGER') AS can_trigger,
    has_table_privilege(r.role_name,t.oid,'MAINTAIN') AS can_maintain
  FROM tables t CROSS JOIN (VALUES ('anon'),('authenticated')) AS r(role_name)
)
SELECT role_name,
  COUNT(*)::int AS public_tables_checked,
  count(*) FILTER(WHERE can_truncate)::int AS truncate_grants,
  count(*) FILTER(WHERE can_references)::int AS references_grants,
  count(*) FILTER(WHERE can_trigger)::int AS trigger_grants,
  count(*) FILTER(WHERE can_maintain)::int AS maintain_grants,
  count(*) FILTER(WHERE can_truncate OR can_references OR can_trigger OR can_maintain)::int
    AS any_tablewide_grants
FROM grants GROUP BY role_name ORDER BY role_name;

-- Table-level names only, no user data, to scope a staged privilege plan.
WITH tables AS MATERIALIZED (
  SELECT c.oid,c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
)
SELECT relname AS public_table_name,
  has_table_privilege('anon',oid,'TRUNCATE') AS anon_truncate,
  has_table_privilege('authenticated',oid,'TRUNCATE') AS authenticated_truncate,
  has_table_privilege('anon',oid,'TRIGGER') AS anon_trigger,
  has_table_privilege('authenticated',oid,'TRIGGER') AS authenticated_trigger
FROM tables
WHERE has_table_privilege('anon',oid,'TRUNCATE')
   OR has_table_privilege('authenticated',oid,'TRUNCATE')
ORDER BY relname;

-- Future new tables may regain these privileges via creator-owned defaults.
-- Audit the defaults without changing them; managed supabase_admin settings
-- require provider-supported controls rather than guessed ALTER DEFAULTs.
SELECT d.defaclrole::regrole::text AS creator_role,
       d.defaclnamespace::regnamespace::text AS schema_name,
       d.defaclobjtype AS object_kind,
       e.grantee::regrole::text AS grantee_role,
       e.privilege_type AS privilege
FROM pg_default_acl d
CROSS JOIN LATERAL aclexplode(d.defaclacl) e
WHERE d.defaclnamespace='public'::regnamespace
  AND d.defaclobjtype='r'
  AND e.grantee::regrole::text IN ('anon','authenticated')
  AND e.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
ORDER BY creator_role,grantee_role,privilege;

COMMIT;
