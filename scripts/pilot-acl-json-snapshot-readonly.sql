-- WETUDY P0 #375 — snapshot ACL in machine-readable JSON.
-- Execute with psql -X -A -t -v ON_ERROR_STOP=1 -f THIS_FILE
-- and redirect stdout to a PRIVATE file. Contains ONLY privilege metadata.
-- The DB itself is unchanged. Never commit before/after snapshots.
BEGIN TRANSACTION READ ONLY;
WITH scope(table_name) AS (
  VALUES
    ('saved_searches'),('saved_search_matches'),('user_marketplace_preferences'),
    ('profiles'),('listings'),('listing_photos'),('schools'),('school_codes'),
    ('school_access_codes'),('user_roles'),('notifications')
), client_roles(grantee_role) AS (
  VALUES ('anon'),('authenticated')
), permissions(privilege_name) AS (
  VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
         ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')
), evidence AS (
 SELECT c.relname::text AS table_name,
        cr.grantee_role::text,
        perm.privilege_name::text,
        has_table_privilege(cr.grantee_role,c.oid,perm.privilege_name) AS effective_privilege,
        count(a.grantor)::int AS direct_grant_count,
        coalesce(string_agg(distinct a.grantor::regrole::text,','),'') AS direct_grantors,
        coalesce(bool_or(a.is_grantable),false) AS direct_grant_option
 FROM scope s JOIN pg_class c ON c.relname=s.table_name
   AND c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
 CROSS JOIN client_roles cr CROSS JOIN permissions perm
 LEFT JOIN LATERAL aclexplode(c.relacl) a
  ON a.grantee=(select oid from pg_roles where rolname=cr.grantee_role)
  AND a.privilege_type=perm.privilege_name
 GROUP BY c.relname,c.oid,cr.grantee_role,perm.privilege_name
)
SELECT CASE WHEN count(*)=176
 THEN coalesce(jsonb_agg(to_jsonb(evidence) ORDER BY
      table_name,grantee_role,privilege_name),'[]'::jsonb)::text
 ELSE 'INVALID_ACL_SNAPSHOT_INCOMPLETE'
 END AS acl_snapshot
FROM evidence;
COMMIT;
