-- WETUDY #787: compensating fixture for the FIVE-TABLE anon SELECT QA ONLY.
-- NOT a migration or authorization for hosted Supabase. Never run in production.
-- Only use AFTER the five-table revoke in the uniquely named, disposable
-- PostgreSQL 17 database. PostgREST QA runner also enforces loopback + test key.
--
-- A real rollback MUST be independently reviewed against a pre-change ACL
-- snapshot; table-level GRANT alone may not reproduce custom inherited/column
-- permissions and may change guest HTTP responses (42501 -> 200/empty).
BEGIN;

DO $guard$
DECLARE
  item text;
  object_oid oid;
  rls_on boolean;
BEGIN
  IF current_database() <> 'wetudy_pilot_anon_select_wave1' THEN
    RAISE EXCEPTION 'Refusing rollback outside disposable named PG17 QA database';
  END IF;
  IF to_regrole('anon') IS NULL OR to_regrole('authenticated') IS NULL
     OR to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION 'Missing isolated PostgREST roles';
  END IF;
  FOREACH item IN ARRAY ARRAY[
    'agreements','demand_requests','profiles','saved_searches','schools'
  ] LOOP
    SELECT c.oid, c.relrowsecurity INTO object_oid, rls_on
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=item AND c.relkind IN ('r','p');
    IF object_oid IS NULL OR NOT rls_on THEN
      RAISE EXCEPTION 'Rollback blocked: missing RLS-protected table %',item;
    END IF;
    IF has_table_privilege('anon',object_oid,'SELECT') THEN
      RAISE EXCEPTION 'Rollback blocked: anon already has SELECT on %',item;
    END IF;
    IF NOT has_table_privilege('authenticated',object_oid,'SELECT')
       OR NOT has_table_privilege('service_role',object_oid,'SELECT') THEN
      RAISE EXCEPTION 'Rollback blocked: expected signed/service SELECT missing on %',item;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
        AND p.tablename=item AND p.cmd IN ('ALL','SELECT')
        AND ('anon'=ANY(p.roles) OR 'public'=ANY(p.roles))
    ) THEN
      RAISE EXCEPTION 'Rollback blocked: anonymous SELECT policy drift on %',item;
    END IF;
  END LOOP;
END
$guard$;

GRANT SELECT ON TABLE
  public.agreements,
  public.demand_requests,
  public.profiles,
  public.saved_searches,
  public.schools
TO anon;

DO $postflight$
DECLARE
  item text;
BEGIN
  FOREACH item IN ARRAY ARRAY[
    'agreements','demand_requests','profiles','saved_searches','schools'
  ] LOOP
    IF NOT has_table_privilege('anon',format('public.%I',item),'SELECT')
       OR NOT has_table_privilege('authenticated',format('public.%I',item),'SELECT')
       OR NOT has_table_privilege('service_role',format('public.%I',item),'SELECT') THEN
      RAISE EXCEPTION 'Rollback QA did not restore the expected SELECT matrix on %',item;
    END IF;
  END LOOP;
END
$postflight$;

COMMIT;
