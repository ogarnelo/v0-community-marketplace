-- WETUDY #447: REVIEW ONLY. Does not run on production.
-- Isolated second change after explicit review of existing policy and E2E effects.
-- This is deliberately separated from the SELECT proposal in #438.
BEGIN;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.listings FROM anon;
DO $wetudy$
BEGIN
 IF has_table_privilege('anon','public.listings','INSERT')
   OR has_table_privilege('anon','public.listings','UPDATE')
   OR has_table_privilege('anon','public.listings','DELETE') THEN
   RAISE EXCEPTION 'NO_GO: anonymous DML grants remain';
 END IF;
 IF NOT has_table_privilege('authenticated','public.listings','INSERT')
   OR NOT has_table_privilege('authenticated','public.listings','UPDATE')
   OR NOT has_column_privilege('authenticated','public.listings','postal_code','INSERT')
   OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE') THEN
   RAISE EXCEPTION 'NO_GO: authenticated postal-code editing is broken';
 END IF;
 IF NOT has_table_privilege('service_role','public.listings','SELECT') THEN
   RAISE EXCEPTION 'NO_GO: backend feed permission broken';
 END IF;
END $wetudy$;
COMMIT;
-- No automatic rollback that re-grants broad anonymous SELECT.
-- Review impact of permissions through local PostgREST before approval.
