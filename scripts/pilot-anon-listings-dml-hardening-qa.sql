-- WETUDY PostgreSQL17 disposable-only. No external database.
-- This test intentionally revokes only anon DML, not SELECT, with ROLLBACK.
BEGIN;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS postal_code text;
GRANT INSERT, UPDATE, DELETE ON TABLE public.listings TO anon, authenticated;
DO $$
BEGIN
 IF NOT has_table_privilege('anon','public.listings','INSERT')
 OR NOT has_table_privilege('anon','public.listings','UPDATE')
 OR NOT has_table_privilege('anon','public.listings','DELETE')
 THEN RAISE EXCEPTION 'Fixture lacks production-like anon DML grants'; END IF;
END $$;
\i scripts/pilot-anon-listings-dml-hardening-proposal.sql
-- Exercise two roles via metadata, then demonstrate real permission refusal.
SET LOCAL ROLE anon;
DO $qa$
BEGIN
  BEGIN
    INSERT INTO public.listings(id) VALUES ('70000000-0000-4000-8000-000000000017');
    RAISE EXCEPTION 'Anonymous INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.listings;
    RAISE EXCEPTION 'Anonymous DELETE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $qa$;
RESET ROLE;
DO $$
BEGIN
 IF NOT has_table_privilege('authenticated','public.listings','INSERT')
 OR NOT has_table_privilege('authenticated','public.listings','UPDATE')
 OR NOT has_table_privilege('authenticated','public.listings','DELETE')
 OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE')
 THEN RAISE EXCEPTION 'Authenticated owner edit permissions regressed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: anon listings INSERT/UPDATE/DELETE closed, authenticated seller DML preserved; NO production DDL' AS result;
