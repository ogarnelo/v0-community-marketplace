-- Disposable PostgreSQL17 CI ONLY. Tests proposed anon REVOKE without writing production.
-- Existing synthetic listings fixture and anon/authenticated/service_role roles are created earlier.
BEGIN;
-- Synthetic alert fixtures do not define geo columns; create them within rollback scope.
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS lng double precision;
GRANT SELECT ON TABLE public.listings TO anon, authenticated, service_role;
-- Simulate old dangerous grant. Role privileges are isolated to this transaction.
DO $$
BEGIN
  IF NOT has_table_privilege('anon','public.listings','SELECT') THEN
    RAISE EXCEPTION 'Synthetic baseline grant missing';
  END IF;
END $$;
REVOKE SELECT ON TABLE public.listings FROM anon;
DO $$
BEGIN
  IF has_table_privilege('anon','public.listings','SELECT')
    OR has_column_privilege('anon','public.listings','postal_code','SELECT')
    OR has_column_privilege('anon','public.listings','seller_id','SELECT')
    OR has_column_privilege('anon','public.listings','user_id','SELECT')
    OR has_column_privilege('anon','public.listings','lat','SELECT')
    OR has_column_privilege('anon','public.listings','lng','SELECT') THEN
    RAISE EXCEPTION 'Anon tablewide/column SELECT still exposed';
  END IF;
  IF NOT has_table_privilege('authenticated','public.listings','SELECT')
    OR NOT has_table_privilege('service_role','public.listings','SELECT') THEN
    RAISE EXCEPTION 'Other roles lost SELECT';
  END IF;
END $$;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM id FROM public.listings LIMIT 1;
    RAISE EXCEPTION 'Anonymous full listing SELECT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: anonymous full SELECT revoked without altering authenticated/service access' AS result;
