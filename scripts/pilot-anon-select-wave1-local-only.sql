-- WETUDY P0: review-only proposal for five anonymous SELECT grants.
-- This file is NOT a Supabase migration. Run ONLY in the named disposable PG17 database.
-- Production remediation requires a separately reviewed migration and explicit approval.
BEGIN;

DO $preflight$
DECLARE
  table_name text;
  table_oid oid;
  rls_enabled boolean;
BEGIN
  IF current_database() <> 'wetudy_pilot_anon_select_wave1' THEN
    RAISE EXCEPTION 'Refusing non-disposable database: anon SELECT proposal';
  END IF;
  IF to_regrole('anon') IS NULL OR to_regrole('authenticated') IS NULL
     OR to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION 'Missing synthetic client role';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'agreements','demand_requests','profiles','saved_searches','schools'
  ] LOOP
    SELECT c.oid, c.relrowsecurity INTO table_oid, rls_enabled
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = table_name
      AND c.relkind IN ('r','p');
    IF table_oid IS NULL OR NOT rls_enabled THEN
      RAISE EXCEPTION 'Missing table or RLS is OFF: %', table_name;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = table_name
        AND p.cmd IN ('ALL','SELECT')
        AND ('anon' = ANY(p.roles) OR 'public' = ANY(p.roles))
    ) THEN
      RAISE EXCEPTION 'Anonymous SELECT policy requires manual review: %', table_name;
    END IF;
  END LOOP;
END
$preflight$;

REVOKE SELECT ON TABLE
  public.agreements,
  public.demand_requests,
  public.profiles,
  public.saved_searches,
  public.schools
FROM anon;

DO $postflight$
DECLARE
  table_name text;
  table_oid oid;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'agreements','demand_requests','profiles','saved_searches','schools'
  ] LOOP
    SELECT c.oid INTO STRICT table_oid
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = table_name
      AND c.relkind IN ('r','p');
    IF has_table_privilege('anon', table_oid, 'SELECT')
       OR EXISTS (
         SELECT 1 FROM pg_attribute a
         WHERE a.attrelid = table_oid AND a.attnum > 0
           AND NOT a.attisdropped
           AND has_column_privilege('anon', table_oid, a.attnum, 'SELECT')
       ) THEN
      RAISE EXCEPTION 'Anonymous SELECT survives via table, PUBLIC, or column: %', table_name;
    END IF;
    IF NOT has_table_privilege('authenticated', table_oid, 'SELECT')
       OR NOT has_table_privilege('service_role', table_oid, 'SELECT') THEN
      RAISE EXCEPTION 'Authorized SELECT unexpectedly missing: %', table_name;
    END IF;
  END LOOP;
END
$postflight$;

COMMIT;
