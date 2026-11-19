-- WETUDY: authorized owner-only handoff for the 16 unresolved future-table ACLs.
-- DO NOT execute with the Supabase dashboard's ordinary postgres role:
-- verified on 2026-11-19 that postgres is NOT a member of supabase_admin.
-- Execution requires a legitimately authenticated supabase_admin context
-- (e.g. an approved Supabase operator). Not applied by CI or by migrations.
-- Only future public tables OWNED BY supabase_admin are affected.
-- No table, row, RLS policy or existing grant is changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE
  v_grants integer;
BEGIN
  IF current_user <> 'supabase_admin' THEN
    RAISE EXCEPTION 'WETUDY_REQUIRES_SUPABASE_ADMIN_OWNER_CONTEXT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_default_acl d
    WHERE d.defaclrole='supabase_admin'::regrole
      AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
  ) THEN
    RAISE EXCEPTION 'WETUDY_SUPABASE_ADMIN_DEFAULT_ACL_MISSING';
  END IF;
  SELECT count(*) INTO v_grants
  FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole='supabase_admin'::regrole
    AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
    AND a.grantee IN ('anon'::regrole,'authenticated'::regrole);
  IF v_grants <> 16 THEN
    RAISE EXCEPTION 'WETUDY_DEFAULT_ACL_DRIFT_EXPECTED_16_ACTUAL_%',v_grants;
  END IF;
END
$preflight$;

-- Capture exact current ordinary owner/service grants for postflight,
-- not just a count: these must remain byte-for-byte identical.
CREATE TEMP TABLE wetudy_acl_owner_baseline ON COMMIT DROP AS
SELECT a.grantee,a.grantor,a.privilege_type,a.is_grantable
FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE d.defaclrole='supabase_admin'::regrole
  AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
  AND a.grantee IN ('postgres'::regrole,'service_role'::regrole);

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon,authenticated;

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole='supabase_admin'::regrole
      AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
      AND a.grantee IN ('anon'::regrole,'authenticated'::regrole)
  ) THEN
    RAISE EXCEPTION 'WETUDY_CLIENT_DEFAULT_ACL_NOT_REVOKED';
  END IF;
  IF EXISTS (
    (SELECT grantee,grantor,privilege_type,is_grantable
      FROM wetudy_acl_owner_baseline
     EXCEPT
     SELECT a.grantee,a.grantor,a.privilege_type,a.is_grantable
     FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
     WHERE d.defaclrole='supabase_admin'::regrole
       AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
       AND a.grantee IN ('postgres'::regrole,'service_role'::regrole))
    UNION ALL
    (SELECT a.grantee,a.grantor,a.privilege_type,a.is_grantable
     FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
     WHERE d.defaclrole='supabase_admin'::regrole
       AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
       AND a.grantee IN ('postgres'::regrole,'service_role'::regrole)
     EXCEPT
     SELECT grantee,grantor,privilege_type,is_grantable
      FROM wetudy_acl_owner_baseline)
  ) THEN
    RAISE EXCEPTION 'WETUDY_ORDINARY_OWNER_OR_SERVICE_GRANTS_CHANGED';
  END IF;
END
$postflight$;
COMMIT;
