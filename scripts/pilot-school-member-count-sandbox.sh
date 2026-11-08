#!/usr/bin/env bash
# Disposable localhost PG17 only. Do not run against Supabase production.
set -euo pipefail
: "${DATABASE_URL:?Provide disposable localhost DATABASE_URL}"
python3 - <<'PY'
from urllib.parse import urlsplit
import os
u=urlsplit(os.environ["DATABASE_URL"])
if u.scheme not in ("postgres","postgresql") or u.hostname not in ("localhost","127.0.0.1","::1"):
    raise SystemExit("Refusing to run member aggregation against nonlocal DB")
PY
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,school_id uuid);
CREATE TABLE public.account_students(id uuid PRIMARY KEY,owner_user_id uuid,school_id uuid,active boolean);
CREATE TABLE public.user_roles(id uuid PRIMARY KEY,user_id uuid,school_id uuid,role text);
INSERT INTO public.profiles VALUES
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201'),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000201'),
('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000201'),
('00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000201'),
('00000000-0000-4000-8000-000000000105','00000000-0000-4000-8000-000000000202'),
('00000000-0000-4000-8000-000000000106','00000000-0000-4000-8000-000000000202'),
('00000000-0000-4000-8000-000000000108','00000000-0000-4000-8000-000000000202');
INSERT INTO public.account_students VALUES
('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201',true),
('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201',true),
('00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000201',true),
('00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000202',true),
('00000000-0000-4000-8000-000000000305','00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000202',true),
('00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000105','00000000-0000-4000-8000-000000000202',true),
('00000000-0000-4000-8000-000000000307','00000000-0000-4000-8000-000000000108','00000000-0000-4000-8000-000000000201',false),
('00000000-0000-4000-8000-000000000308','00000000-0000-4000-8000-000000000107','00000000-0000-4000-8000-000000000201',true);
INSERT INTO public.user_roles VALUES
('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000106','00000000-0000-4000-8000-000000000201','school_admin');
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.profiles,public.account_students,public.user_roles TO service_role;
SQL

psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/pilot-school-member-count-candidate.sql
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
DO $test$
DECLARE
 v_a bigint;
 v_b bigint;
BEGIN
 v_a := public.pilot_school_member_count('00000000-0000-4000-8000-000000000201');
 v_b := public.pilot_school_member_count('00000000-0000-4000-8000-000000000202');
 IF v_a <> 4 OR v_b <> 5 THEN
   RAISE EXCEPTION 'Wrong school membership A=%, B=% (expected 4 and 5)',v_a,v_b;
 END IF;
 IF has_function_privilege('anon','public.pilot_school_member_count(uuid)','EXECUTE')
   OR has_function_privilege('authenticated','public.pilot_school_member_count(uuid)','EXECUTE')
   OR NOT has_function_privilege('service_role','public.pilot_school_member_count(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'Candidate SQL aggregate function privilege violation';
 END IF;
END $test$;
BEGIN;
SET LOCAL ROLE service_role;
DO $test$
BEGIN
 IF public.pilot_school_member_count('00000000-0000-4000-8000-000000000201') <> 4
 OR public.pilot_school_member_count('00000000-0000-4000-8000-000000000202') <> 5 THEN
   RAISE EXCEPTION 'Service role expected scoped aggregate';
 END IF;
END $test$;
ROLLBACK;
SQL
echo "PASS: per-school aggregate A=4 B=5; duplicates, cross-school active students, roles and missing profiles; only service_role EXECUTE."
