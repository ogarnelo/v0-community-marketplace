-- QA only: installed after the real three-AMPA local browser flow has finished.
-- The runner points at the ephemeral Supabase CLI localhost Postgres.
-- No production project, no personal records and no permanent SQL migration.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;
UPDATE public.listings SET postal_code='28001', lat=40.42, lng=-3.70;
INSERT INTO public.listings (id,title,status,postal_code) VALUES
 ('99999999-9999-4999-8999-999999999999','ARCHIVED QA PRIVATE','archived','28002');

CREATE TABLE public.listing_photos (
 id uuid PRIMARY KEY,
 listing_id uuid NOT NULL,
 url text NOT NULL
);
INSERT INTO public.listing_photos VALUES
 ('99999999-9999-4999-8999-999999999901',
  '11111111-1111-4111-8111-111111111111','https://example.invalid/qa-photo');

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_public_available ON public.listings FOR SELECT TO PUBLIC
 USING (status='available');
ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_photo_depends_on_listings ON public.listing_photos
 FOR SELECT TO PUBLIC USING (
  EXISTS(SELECT 1 FROM public.listings l WHERE l.id=listing_photos.listing_id)
 );
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT SELECT ON public.listings TO anon,authenticated,service_role;
GRANT SELECT ON public.listing_photos TO anon,authenticated,service_role;

-- Apply both privacy grants to the LOCAL data API, never the user project.
REVOKE SELECT ON public.listings FROM anon;
REVOKE SELECT ON public.listings FROM authenticated;
GRANT SELECT (id,title,status,school_id,seller_id)
 ON public.listings TO authenticated;
NOTIFY pgrst, 'reload schema';
