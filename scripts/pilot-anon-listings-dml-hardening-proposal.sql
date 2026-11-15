-- REVIEW ONLY: separate defense-in-depth stage for public.listings.
-- NOT applied in production. Run only after founder approval and after
-- verifying existing RLS/published functionality. SELECT privacy is separate.
-- Owner INSERT/UPDATE/DELETE of authenticated must remain unchanged.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.listings FROM anon;
DO $$
BEGIN
 IF has_table_privilege('anon','public.listings','INSERT')
    OR has_table_privilege('anon','public.listings','UPDATE')
    OR has_table_privilege('anon','public.listings','DELETE')
    OR has_any_column_privilege('anon','public.listings','INSERT')
    OR has_any_column_privilege('anon','public.listings','UPDATE')
 THEN RAISE EXCEPTION 'NO_GO: anon still has listings table/column DML privileges'; END IF;
 IF NOT has_table_privilege('authenticated','public.listings','INSERT')
    OR NOT has_table_privilege('authenticated','public.listings','UPDATE')
    OR NOT has_table_privilege('authenticated','public.listings','DELETE')
    OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE')
 THEN RAISE EXCEPTION 'NO_GO: seller write privileges have been altered'; END IF;
END $$;
-- A future default grant or PUBLIC role can still reintroduce DML: audit
-- has_table_privilege after each migration. Keep RLS owner checks.
