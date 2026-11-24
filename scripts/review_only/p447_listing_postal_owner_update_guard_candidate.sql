-- WETUDY P0/#447 — REVIEW ONLY; never auto-install or execute on prod.
-- This complements the already-installed anon DML revocation and the
-- BEFORE INSERT snapshot trigger. New specific owner authorization required.
-- Scope: immutable postcode of an existing listing for ordinary authenticated
-- members, without revoking other UPDATE columns or altering RLS/table grants.
-- A trusted service_role/admin import can still correct historical locations.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';

DO $preflight$
BEGIN
  IF to_regclass('public.listings') IS NULL
     OR NOT EXISTS(
       SELECT 1 FROM pg_class c
       WHERE c.oid='public.listings'::regclass AND c.relrowsecurity
     )
     OR NOT EXISTS(
       SELECT 1 FROM pg_namespace WHERE nspname='wetudy_internal'
     )
     OR NOT EXISTS(
       SELECT 1 FROM pg_trigger t
       WHERE t.tgrelid='public.listings'::regclass
         AND t.tgname='marketplace_listing_postal_snapshot_before_insert_v1'
         AND NOT t.tgisinternal
     )
     OR to_regprocedure(
       'wetudy_internal.marketplace_listing_postal_owner_update_guard_v1()'
     ) IS NOT NULL
     OR EXISTS(
       SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.listings'::regclass
         AND t.tgname='marketplace_listing_postal_owner_update_guard_v1'
     )
     OR NOT has_table_privilege('authenticated','public.listings','UPDATE')
     OR NOT has_column_privilege(
       'authenticated','public.listings','postal_code','UPDATE'
     )
     OR has_table_privilege('anon','public.listings','UPDATE')
     OR has_any_column_privilege('anon','public.listings','UPDATE')
     OR has_table_privilege('anon','public.listings','INSERT')
     OR has_any_column_privilege('anon','public.listings','INSERT')
     OR has_table_privilege('anon','public.listings','DELETE')
  THEN
    RAISE EXCEPTION 'NO_GO_P447_OLD_ACL_RLS_OR_POSTAL_TRIGGER_DRIFT';
  END IF;
END $preflight$;

CREATE TEMP TABLE p447_previous_state ON COMMIT DROP AS
SELECT
 (SELECT c.relacl::text FROM pg_class c WHERE c.oid='public.listings'::regclass) AS acl_before,
 (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid='public.listings'::regclass) AS rls_before,
 (SELECT jsonb_agg(
    jsonb_build_object(
      'name',policyname,'cmd',cmd,'roles',roles,'qual',qual,'check',with_check
    ) ORDER BY policyname
  ) FROM pg_policies WHERE schemaname='public' AND tablename='listings') AS policies_before,
 (SELECT count(*) FROM public.listings) AS rows_before;

CREATE FUNCTION wetudy_internal.marketplace_listing_postal_owner_update_guard_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $p447$
BEGIN
  IF current_user = 'authenticated'
     AND NEW.postal_code IS DISTINCT FROM OLD.postal_code
  THEN
    RAISE EXCEPTION 'listing_postal_code_immutable_after_publication'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$p447$;

CREATE TRIGGER marketplace_listing_postal_owner_update_guard_v1
BEFORE UPDATE OF postal_code ON public.listings
FOR EACH ROW
WHEN (OLD.postal_code IS DISTINCT FROM NEW.postal_code)
EXECUTE FUNCTION wetudy_internal.marketplace_listing_postal_owner_update_guard_v1();

REVOKE ALL ON FUNCTION wetudy_internal.marketplace_listing_postal_owner_update_guard_v1()
FROM PUBLIC,anon,authenticated;

DO $postflight$
DECLARE v_function oid:=to_regprocedure(
 'wetudy_internal.marketplace_listing_postal_owner_update_guard_v1()')::oid;
BEGIN
 IF v_function IS NULL
    OR (SELECT p.prosecdef FROM pg_proc p WHERE p.oid=v_function)
    OR NOT EXISTS(
       SELECT 1 FROM pg_proc p WHERE p.oid=v_function
       AND p.proconfig @> ARRAY['search_path=""']
    )
    OR has_function_privilege('anon',v_function,'EXECUTE')
    OR has_function_privilege('authenticated',v_function,'EXECUTE')
    OR EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid='public.listings'::regclass
      AND t.tgname='marketplace_listing_postal_owner_update_guard_v1'
      AND t.tgenabled <> 'O'
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid='public.listings'::regclass
      AND t.tgname='marketplace_listing_postal_owner_update_guard_v1'
      AND t.tgenabled='O'
    )
    OR (SELECT c.relacl::text FROM pg_class c
        WHERE c.oid='public.listings'::regclass)
       IS DISTINCT FROM (SELECT acl_before FROM p447_previous_state)
    OR (SELECT c.relrowsecurity FROM pg_class c
        WHERE c.oid='public.listings'::regclass)
       IS DISTINCT FROM (SELECT rls_before FROM p447_previous_state)
    OR (SELECT jsonb_agg(jsonb_build_object(
         'name',policyname,'cmd',cmd,'roles',roles,'qual',qual,'check',with_check
       ) ORDER BY policyname)
       FROM pg_policies WHERE schemaname='public' AND tablename='listings')
       IS DISTINCT FROM (SELECT policies_before FROM p447_previous_state)
    OR (SELECT count(*) FROM public.listings)
       IS DISTINCT FROM (SELECT rows_before FROM p447_previous_state)
 THEN
   RAISE EXCEPTION 'NO_GO_P447_AFTER_GUARD_ACL_RLS_OR_DATA_CHANGED';
 END IF;
END $postflight$;
COMMIT;

-- ROLLBACK — requires another explicit owner authorization:
-- BEGIN; DROP TRIGGER marketplace_listing_postal_owner_update_guard_v1
-- ON public.listings;
-- DROP FUNCTION wetudy_internal.marketplace_listing_postal_owner_update_guard_v1();
-- COMMIT; then independently recheck RLS, table ACL, rows and INSERT trigger.
-- Never drop the already-existing BEFORE INSERT snapshot trigger.
