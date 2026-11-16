#!/usr/bin/env bash
set -euo pipefail
: "$DATABASE_URL"
case "$DATABASE_URL" in
  *"@127.0.0.1:5432/"*) ;;
  *) echo "REFUSED: requires disposable PostgreSQL on 127.0.0.1:5432" >&2; exit 2 ;;
esac
export PGCONNECT_TIMEOUT=5
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
CREATE TABLE public.schools(id uuid PRIMARY KEY);
CREATE TABLE public.listings(
 id uuid PRIMARY KEY, seller_id uuid, school_id uuid REFERENCES public.schools(id),
 status text, listing_type text NOT NULL, type text
);
CREATE TABLE public.donation_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 listing_id uuid REFERENCES public.listings(id),
 requester_id uuid, status text DEFAULT 'pending',
 school_id uuid REFERENCES public.schools(id),
 approved_by_admin_id uuid, assigned_to_requester_id uuid,
 CONSTRAINT donation_requests_status_check
 CHECK(status IN ('pending','approved','rejected','reassigned','completed','cancelled'))
);
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY listings_select_available_public ON public.listings
 FOR SELECT TO public USING(status='available');
CREATE POLICY "Users can create donation requests" ON public.donation_requests
 FOR INSERT TO public WITH CHECK((SELECT auth.uid())=requester_id);
CREATE POLICY "Users can view own donation requests" ON public.donation_requests
 FOR SELECT TO public USING((SELECT auth.uid())=requester_id);
GRANT USAGE ON SCHEMA public TO authenticated,anon;
GRANT SELECT ON public.listings TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.donation_requests TO authenticated;
GRANT INSERT ON public.donation_requests TO anon;
INSERT INTO public.schools(id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.listings(id,seller_id,school_id,status,listing_type,type) VALUES
 ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','available','donation','donation'),
 ('22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','available','donation','donation'),
 ('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','available','sale','donation'),
 ('44444444-4444-4444-8444-444444444444','cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','archived','donation','donation'),
 ('55555555-5555-4555-8555-555555555555','cccccccc-cccc-4ccc-8ccc-cccccccccccc',NULL,'available','donation','donation');
-- Demostración de debilidad original: solo en datos sintéticos.
SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
SET ROLE authenticated;
INSERT INTO public.donation_requests(id,listing_id,requester_id,status,school_id,approved_by_admin_id)
 VALUES('66666666-6666-4666-8666-666666666666',
 '11111111-1111-4111-8111-111111111111',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','approved',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'ffffffff-ffff-4fff-8fff-ffffffffffff');
RESET ROLE;
DELETE FROM public.donation_requests WHERE id='66666666-6666-4666-8666-666666666666';
SELECT 'BASELINE_WEAK_INSERT_REPRODUCED_ONLY_IN_FIXTURE' AS evidence;
SQL

# Ejecutar preflight REAL de la candidata y DDL solo en contenedor desechable.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/p0_donation_rls_preflight_read_only.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/p0_donation_rls_remediation_review_only.sql

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
SET ROLE authenticated;
-- Solicitante legítimo de A.
INSERT INTO public.donation_requests(id,listing_id,requester_id,status,school_id)
 VALUES('77777777-7777-4777-8777-777777777777',
 '11111111-1111-4111-8111-111111111111',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','pending',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
-- Listado sin colegio, nulos válidos.
INSERT INTO public.donation_requests(id,listing_id,requester_id,status,school_id)
 VALUES('88888888-8888-4888-8888-888888888888',
 '55555555-5555-4555-8555-555555555555',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','pending',NULL);
DO $verify$
DECLARE c record; denied int:=0;
BEGIN
 FOR c IN SELECT * FROM (VALUES
  ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','approved','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,NULL),
  ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','pending','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',NULL,NULL),
  ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','pending','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-ffff-4fff-8fff-ffffffffffff',NULL),
  ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','pending','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,'ffffffff-ffff-4fff-8fff-ffffffffffff'),
  ('33333333-3333-4333-8333-333333333333','dddddddd-dddd-4ddd-8ddd-dddddddddddd','pending','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,NULL),
  ('44444444-4444-4444-8444-444444444444','dddddddd-dddd-4ddd-8ddd-dddddddddddd','pending','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,NULL),
  ('11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','pending','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,NULL),
  (NULL,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','pending',NULL,NULL,NULL)
 ) AS t(listing_id,requester_id,status,school_id,reviewer,assignee)
 LOOP
  BEGIN
   INSERT INTO public.donation_requests(listing_id,requester_id,status,school_id,approved_by_admin_id,assigned_to_requester_id)
   VALUES(c.listing_id::uuid,c.requester_id::uuid,c.status,c.school_id::uuid,c.reviewer::uuid,c.assignee::uuid);
   RAISE EXCEPTION 'SECURITY_FAILURE: unwanted INSERT accepted';
  EXCEPTION WHEN insufficient_privilege THEN
   denied:=denied+1;
  END;
 END LOOP;
 IF denied<>8 THEN RAISE EXCEPTION 'Expected eight RLS denials, got %',denied; END IF;
 RAISE NOTICE 'RLS_EIGHT_BAD_INSERTS_BLOCKED';
END $verify$;
RESET ROLE;
INSERT INTO public.donation_requests(id,listing_id,requester_id,status,school_id)
 VALUES('99999999-9999-4999-8999-999999999999',
 '11111111-1111-4111-8111-111111111111',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','pending',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
UPDATE public.donation_requests SET status='approved'
 WHERE id='77777777-7777-4777-8777-777777777777';
DO $dupe$
BEGIN
 BEGIN
  UPDATE public.donation_requests SET status='approved'
   WHERE id='99999999-9999-4999-8999-999999999999';
  RAISE EXCEPTION 'SECURITY_FAILURE: second approved request allowed';
 EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'UNIQUE_DOUBLE_APPROVAL_BLOCKED';
 END;
END $dupe$;
SELECT CASE WHEN count(*)=1 THEN 'ONE_APPROVAL_ONLY' ELSE 'SECURITY_FAILURE' END AS uniqueness
 FROM public.donation_requests WHERE listing_id='11111111-1111-4111-8111-111111111111'
 AND status='approved';
SQL
echo "PG17_REAL_ISOLATED_TEST_PASSED; NEVER TOUCHED SUPABASE"
