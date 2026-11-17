-- WETUDY P0 privileged default-ACL executor diagnosis, READ ONLY.
-- No SET ROLE, no role membership edits, no ALTER DEFAULT PRIVILEGES.
BEGIN READ ONLY;

SELECT current_user AS executor,
       session_user AS session_role,
       (current_user = 'supabase_admin'
        OR pg_has_role(current_user, 'supabase_admin', 'MEMBER')) AS authorized_to_change_supabase_admin_defaults;

SELECT pg_get_userbyid(d.defaclrole) AS creator_role,
       n.nspname AS target_schema,
       pg_get_userbyid(a.grantee) AS recipient_role,
       a.privilege_type
FROM pg_default_acl d
JOIN pg_namespace n ON n.oid=d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE d.defaclobjtype='r'
  AND n.nspname='public'
  AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
  AND pg_get_userbyid(a.grantee) IN ('anon','authenticated')
ORDER BY creator_role,recipient_role,privilege_type;

-- Snapshot grants of existing table; these must not change when changing FUTURE defaults.
SELECT
  has_table_privilege('anon','public.listings','SELECT') AS anon_listings_select,
  has_table_privilege('authenticated','public.listings','UPDATE') AS authenticated_listings_update,
  has_column_privilege('authenticated','public.listings','postal_code','UPDATE') AS authenticated_postal_code_update,
  has_table_privilege('service_role','public.listings','SELECT') AS service_listings_select;

COMMIT;
