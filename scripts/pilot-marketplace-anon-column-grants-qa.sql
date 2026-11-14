-- WETUDY — hypothesis test on DISPOSABLE PG17 only.
-- NOT a production migration. Demonstrates a safe column-grant mechanism
-- while documenting the explicit SELECT * compatibility break.
-- Earlier CI creates the tiny, synthetic public.listings fixture and anon role.
BEGIN;
ALTER TABLE public.listings ADD COLUMN postal_code text;
ALTER TABLE public.listings ADD COLUMN lat double precision;
ALTER TABLE public.listings ADD COLUMN lng double precision;
GRANT SELECT ON public.listings TO anon;
DO $$
BEGIN
 IF NOT has_column_privilege('anon','public.listings','postal_code','SELECT')
    OR NOT has_column_privilege('anon','public.listings','lat','SELECT')
    OR NOT has_column_privilege('anon','public.listings','lng','SELECT') THEN
   RAISE EXCEPTION 'Synthetic test did not start with unsafe tablewide SELECT';
 END IF;
END $$;

-- On the synthetic table only, remove wildcard SELECT and re-grant a small
-- public contract; leave sensitive CP and precise coordinates inaccessible.
REVOKE SELECT ON public.listings FROM anon;
GRANT SELECT (id, status, is_demo, seller_id, user_id) ON public.listings TO anon;
DO $$
BEGIN
 IF NOT has_column_privilege('anon','public.listings','id','SELECT')
    OR NOT has_column_privilege('anon','public.listings','status','SELECT')
    OR has_column_privilege('anon','public.listings','postal_code','SELECT')
    OR has_column_privilege('anon','public.listings','lat','SELECT')
    OR has_column_privilege('anon','public.listings','lng','SELECT')
 THEN RAISE EXCEPTION 'Column-grant minimization did not isolate CP and coordinates';
 END IF;
END $$;
SET LOCAL ROLE anon;
SELECT count(id) AS readable_public_listing_ids FROM public.listings;
DO $$
BEGIN
  BEGIN
    PERFORM postal_code FROM public.listings LIMIT 1;
    RAISE EXCEPTION 'Anon unexpectedly read full CP';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM lat, lng FROM public.listings LIMIT 1;
    RAISE EXCEPTION 'Anon unexpectedly read coordinates';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.listings LIMIT 1;
    RAISE EXCEPTION 'SELECT star unexpectedly works; consumer inventory gate broken';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
-- Preserve the schema of all other alert fixtures and the following smoke.
SELECT 'PASS: synthetic anon can read minimal columns but not CP/coords or SELECT star' AS result;
