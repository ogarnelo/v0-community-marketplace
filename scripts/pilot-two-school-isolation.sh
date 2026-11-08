#!/usr/bin/env bash
# Two-school role isolation with synthetic data ONLY in a disposable local PG.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to an isolated local PostgreSQL}"
python3 - <<'PY'
import os
from urllib.parse import urlsplit
u = urlsplit(os.environ["DATABASE_URL"])
if u.scheme not in ("postgres", "postgresql") or u.hostname not in ("127.0.0.1", "localhost", "::1"):
    raise SystemExit("Refusing to run RLS tests against a nonlocal database")
PY

psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL,
  school_id uuid
);
CREATE TABLE public.school_access_codes (
  id uuid PRIMARY KEY,
  school_id uuid NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL
);
INSERT INTO public.user_roles(id, user_id, role, school_id) VALUES
('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000101','school_admin','00000000-0000-4000-8000-000000000201'),
('00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000102','school_admin','00000000-0000-4000-8000-000000000202'),
('00000000-0000-4000-8000-000000000903','00000000-0000-4000-8000-000000000103','super_admin',null);
INSERT INTO public.school_access_codes(id,school_id,code,is_active) VALUES
('00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000201','SCHOOL_A_TEST',true),
('00000000-0000-4000-8000-000000000802','00000000-0000-4000-8000-000000000202','SCHOOL_B_TEST',true);

-- A definer bypasses recursive RLS for superadmin lookup, as in the live app.
CREATE FUNCTION public.is_superadmin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
  WHERE user_id=auth.uid() AND role='super_admin');
$$;
REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_access_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_select_authorized
  ON public.user_roles FOR SELECT TO authenticated
  USING ((SELECT auth.uid())=user_id OR (SELECT public.is_superadmin()));
CREATE POLICY user_roles_insert_superadmin
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_superadmin()));
CREATE POLICY school_access_codes_select_authorized
  ON public.school_access_codes FOR SELECT TO authenticated
  USING (
    (SELECT public.is_superadmin()) OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id=(SELECT auth.uid())
      AND ur.role='school_admin'
      AND ur.school_id=school_access_codes.school_id
    )
  );
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT SELECT ON public.school_access_codes TO authenticated;

-- Each school admin can see only their own membership and code.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.school_access_codes)<>1 OR
    (SELECT count(*) FROM public.school_access_codes WHERE school_id='00000000-0000-4000-8000-000000000202')<>0 OR
    (SELECT count(*) FROM public.user_roles WHERE role='school_admin')<>1 OR
    (SELECT count(*) FROM public.user_roles WHERE role='super_admin')<>0 THEN
   RAISE EXCEPTION 'School A isolated access failed';
 END IF;
 BEGIN
   INSERT INTO public.user_roles VALUES
     ('00000000-0000-4000-8000-000000000999',
      '00000000-0000-4000-8000-000000000101', 'super_admin',null);
   RAISE EXCEPTION 'Privilege escalation unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$check$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.school_access_codes)<>1 OR
    (SELECT count(*) FROM public.school_access_codes WHERE school_id='00000000-0000-4000-8000-000000000201')<>0 OR
    (SELECT count(*) FROM public.user_roles WHERE role='school_admin')<>1 THEN
   RAISE EXCEPTION 'School B isolated access failed';
 END IF;
END
$check$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000104',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.school_access_codes)<>0 OR
    (SELECT count(*) FROM public.user_roles)<>0 THEN
   RAISE EXCEPTION 'Family accessed restricted centre records';
 END IF;
END
$check$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.school_access_codes)<>2 OR
    (SELECT count(*) FROM public.user_roles)<>3 THEN
   RAISE EXCEPTION 'Superadmin expected global access failed';
 END IF;
END
$check$;
ROLLBACK;
SQL
echo "Isolated AMPA RLS PASS: School A/B separation, family denied, superadmin access, escalation denied."
