-- WETUDY P0 proposed future-table default grants, REVIEW ONLY.
-- PostgreSQL17 / Supabase; does not alter existing tables or data.
-- NOT AUTHORIZED FOR PRODUCTION: would change the behavior of FUTURE migrations.
-- Two verified object owners: postgres, supabase_admin; public schema only.
BEGIN;
DO $preflight$
DECLARE n int;
BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_default_acl d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
  WHERE d.defaclobjtype='r' AND d.defaclnamespace=0
  AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
  AND acl.grantee IN (
    (SELECT oid FROM pg_roles WHERE rolname='anon'),
    (SELECT oid FROM pg_roles WHERE rolname='authenticated'))
 ) THEN
  RAISE EXCEPTION 'NO_GO_DEFAULT_ACL: global grants must be reviewed separately';
 END IF;
 SELECT count(*) INTO n
 FROM pg_default_acl d
 CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
 WHERE d.defaclobjtype='r' AND d.defaclnamespace='public'::regnamespace
 AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
 AND acl.grantee IN (
    (SELECT oid FROM pg_roles WHERE rolname='anon'),
    (SELECT oid FROM pg_roles WHERE rolname='authenticated'));
 IF n NOT IN (0,32) THEN
  RAISE EXCEPTION 'NO_GO_DEFAULT_ACL: expected 0 or 32 current client grants, found %',n;
 END IF;
END
$preflight$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 REVOKE ALL ON TABLES FROM anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
 REVOKE ALL ON TABLES FROM anon,authenticated;
DO $postflight$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n
 FROM pg_default_acl d
 CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
 WHERE d.defaclobjtype='r' AND d.defaclnamespace='public'::regnamespace
 AND pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin')
 AND acl.grantee IN (
    (SELECT oid FROM pg_roles WHERE rolname='anon'),
    (SELECT oid FROM pg_roles WHERE rolname='authenticated'));
 IF n<>0 THEN
  RAISE EXCEPTION 'NO_GO_DEFAULT_ACL: client grants persist after revocation';
 END IF;
END
$postflight$;
COMMIT;
