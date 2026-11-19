-- Disposable PostgreSQL 17 ONLY: simulated owner and future table ACLs.
-- Never run this on Supabase or an environment with real users.
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$roles$;
GRANT USAGE,CREATE ON SCHEMA public TO supabase_admin;
SET ROLE supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO
  anon,authenticated,service_role,postgres;
RESET ROLE;

DO $preflight$
DECLARE v_count int;
BEGIN
 SELECT count(*) INTO v_count FROM pg_default_acl d
 CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 WHERE d.defaclrole='supabase_admin'::regrole
 AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
 AND a.grantee IN ('anon'::regrole,'authenticated'::regrole);
 IF v_count <> 16 THEN
  RAISE EXCEPTION 'Synthetic preflight expected 16 client ACLs: %',v_count;
 END IF;
END $preflight$;

SET ROLE supabase_admin;
\ir p0_supabase_admin_owner_only_default_acl_handoff.sql
RESET ROLE;

DO $postflight$
DECLARE v_clients int;v_owners int;
BEGIN
 SELECT count(*) FILTER (WHERE a.grantee IN ('anon'::regrole,'authenticated'::regrole)),
        count(*) FILTER (WHERE a.grantee IN ('postgres'::regrole,'service_role'::regrole))
 INTO v_clients,v_owners
 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 WHERE d.defaclrole='supabase_admin'::regrole
 AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r';
 IF v_clients <> 0 OR v_owners <> 16 THEN
  RAISE EXCEPTION 'Synthetic postflight unexpected client % / owner-service %',v_clients,v_owners;
 END IF;
END $postflight$;

SET ROLE supabase_admin;
CREATE TABLE public.wetudy_synthetic_acl_probe (id int);
RESET ROLE;
DO $probe$
BEGIN
 IF has_table_privilege('anon','public.wetudy_synthetic_acl_probe','SELECT') OR
    has_table_privilege('authenticated','public.wetudy_synthetic_acl_probe','SELECT') OR
    NOT has_table_privilege('service_role','public.wetudy_synthetic_acl_probe','SELECT') THEN
   RAISE EXCEPTION 'Future table privileges are not hardened';
 END IF;
END $probe$;
DROP TABLE public.wetudy_synthetic_acl_probe;
