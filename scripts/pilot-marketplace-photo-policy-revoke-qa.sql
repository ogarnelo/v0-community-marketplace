-- WETUDY. Disposable PostgreSQL 17 ONLY. RLS cross-table dependency regression.
-- This reproduces the production pattern: photo SELECT policy queries listings.
-- No production DDL, private rows or credentials; all changes are rolled back.
BEGIN;
CREATE TABLE public.qa_pilot_rls_listings (id uuid PRIMARY KEY, status text NOT NULL);
CREATE TABLE public.qa_pilot_rls_photos (id uuid PRIMARY KEY, listing_id uuid REFERENCES public.qa_pilot_rls_listings(id));
INSERT INTO public.qa_pilot_rls_listings VALUES ('90000000-0000-4000-8000-000000000001','available');
INSERT INTO public.qa_pilot_rls_photos VALUES ('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001');
ALTER TABLE public.qa_pilot_rls_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_pilot_rls_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_pilot_listings_available ON public.qa_pilot_rls_listings
  FOR SELECT TO PUBLIC USING (status='available');
CREATE POLICY qa_pilot_photos_visible ON public.qa_pilot_rls_photos
  FOR SELECT TO PUBLIC USING (
    EXISTS (SELECT 1 FROM public.qa_pilot_rls_listings q
      WHERE q.id = qa_pilot_rls_photos.listing_id)
  );
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT ON public.qa_pilot_rls_photos TO anon,authenticated;
GRANT SELECT ON public.qa_pilot_rls_listings TO anon;
GRANT SELECT (id,status) ON public.qa_pilot_rls_listings TO authenticated;
SET LOCAL ROLE anon;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.qa_pilot_rls_photos)<>1 THEN
   RAISE EXCEPTION 'Baseline photo RLS did not work';
 END IF;
END $$;
RESET ROLE;

-- This is the proposed sensitive-data protection; the old photo RLS now
-- fails for anon even though anon still has SELECT on the photos table.
REVOKE SELECT ON public.qa_pilot_rls_listings FROM anon;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.qa_pilot_rls_photos;
    RAISE EXCEPTION 'Expected photo policy permission failure did not happen';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Authenticated can still query photos because its limited column grant
-- contains the listing ID needed by the RLS photo policy.
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.qa_pilot_rls_photos)<>1 THEN
   RAISE EXCEPTION 'Authenticated column-grant did not preserve photo RLS';
 END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: anon photo RLS requires listings access; auth ID-only access works' AS result;
