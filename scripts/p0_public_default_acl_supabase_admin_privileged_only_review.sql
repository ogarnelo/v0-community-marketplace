-- WETUDY P0 remaining authorization; REVIEW ONLY, DO NOT APPLY via postgres.
-- Requires a legitimately privileged executor who owns or is a MEMBER of
-- supabase_admin. Never grant new role membership as a workaround.
-- Removes only public-schema default TABLE grants for new objects.
BEGIN;
DO $preflight$
DECLARE admin_count integer; postgres_count integer; global_count integer;
BEGIN
 IF NOT (current_user='supabase_admin' OR pg_has_role(current_user,'supabase_admin','MEMBER')) THEN
   RAISE EXCEPTION 'NO_GO_DEFAULT_ADMIN: executor lacks authorized supabase_admin membership';
 END IF;
 SELECT count(*) FILTER(WHERE pg_get_userbyid(d.defaclrole)='supabase_admin'),
        count(*) FILTER(WHERE pg_get_userbyid(d.defaclrole)='postgres'),
        count(*) FILTER(WHERE d.defaclnamespace=0)
 INTO admin_count,postgres_count,global_count
 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) x
 WHERE d.defaclobjtype='r'
   AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
   AND x.grantee IN ((SELECT oid FROM pg_roles WHERE rolname='anon'),
                     (SELECT oid FROM pg_roles WHERE rolname='authenticated'))
   AND (d.defaclnamespace='public'::regnamespace OR d.defaclnamespace=0);
 IF admin_count<>16 OR postgres_count<>0 OR global_count<>0 THEN
   RAISE EXCEPTION 'NO_GO_DEFAULT_ADMIN: expected remaining owner grants 16/0/0, found %/%/%',
    admin_count,postgres_count,global_count;
 END IF;
END $preflight$;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
 REVOKE ALL ON TABLES FROM anon,authenticated;
DO $postflight$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n
 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) x
 WHERE d.defaclobjtype='r' AND d.defaclnamespace='public'::regnamespace
  AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
  AND x.grantee IN ((SELECT oid FROM pg_roles WHERE rolname='anon'),
                    (SELECT oid FROM pg_roles WHERE rolname='authenticated'));
 IF n<>0 THEN RAISE EXCEPTION 'NO_GO_DEFAULT_ADMIN: default ACL grants remain %',n; END IF;
 IF has_table_privilege('anon','public.listings','SELECT')
 OR NOT has_table_privilege('authenticated','public.listings','UPDATE')
 OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE')
 OR NOT has_table_privilege('service_role','public.listings','SELECT') THEN
  RAISE EXCEPTION 'NO_GO_DEFAULT_ADMIN: existing application grants drifted';
 END IF;
END $postflight$;
COMMIT;
