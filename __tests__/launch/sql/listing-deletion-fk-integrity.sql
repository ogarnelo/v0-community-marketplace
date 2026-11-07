-- Isolated PostgreSQL integration test. Synthetic UUIDs, no production data.
-- Reproduces the known FK ON DELETE CASCADE relationships currently present
-- in Wetudy production, and checks listings.photos / listing_drafts.photos.
BEGIN;
CREATE TABLE public.wetudy_test_listings (
  id uuid PRIMARY KEY,
  seller_id uuid NOT NULL,
  status text NOT NULL,
  photos text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE public.wetudy_test_listing_photos (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.wetudy_test_listings(id) ON DELETE CASCADE,
  url text NOT NULL
);
CREATE TABLE public.wetudy_test_favorites (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.wetudy_test_listings(id) ON DELETE CASCADE
);
CREATE TABLE public.wetudy_test_listing_views (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.wetudy_test_listings(id) ON DELETE CASCADE
);
CREATE TABLE public.wetudy_test_listing_drafts (
  user_id uuid PRIMARY KEY,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb
);
INSERT INTO public.wetudy_test_listings VALUES
  ('11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active',
   ARRAY['https://test.invalid/shared.webp']),
  ('22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active',
   ARRAY['https://test.invalid/shared.webp']),
  ('33333333-3333-4333-8333-333333333333',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active',
   ARRAY['https://test.invalid/orphan.webp']);
INSERT INTO public.wetudy_test_listing_photos VALUES
  ('44444444-4444-4444-8444-444444444444',
   '11111111-1111-4111-8111-111111111111','https://test.invalid/shared.webp'),
  ('55555555-5555-4555-8555-555555555555',
   '22222222-2222-4222-8222-222222222222','https://test.invalid/shared.webp'),
  ('66666666-6666-4666-8666-666666666666',
   '33333333-3333-4333-8333-333333333333','https://test.invalid/orphan.webp');
INSERT INTO public.wetudy_test_favorites VALUES
  ('77777777-7777-4777-8777-777777777777',
   '11111111-1111-4111-8111-111111111111');
INSERT INTO public.wetudy_test_listing_views VALUES
  ('88888888-8888-4888-8888-888888888888',
   '11111111-1111-4111-8111-111111111111');
INSERT INTO public.wetudy_test_listing_drafts VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '[{"url":"https://test.invalid/shared.webp","path":"aaaaaaaa/drafts/current/shared.webp"}]'::jsonb
);

-- A successful parent delete atomically cascades related rows and never
-- deletes rows belonging to another listing that shares a photo URL.
DELETE FROM public.wetudy_test_listings
WHERE id = '11111111-1111-4111-8111-111111111111'
  AND seller_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $assert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.wetudy_test_listing_photos
    WHERE listing_id='11111111-1111-4111-8111-111111111111'
  ) OR EXISTS (
    SELECT 1 FROM public.wetudy_test_favorites
    WHERE listing_id='11111111-1111-4111-8111-111111111111'
  ) OR EXISTS (
    SELECT 1 FROM public.wetudy_test_listing_views
    WHERE listing_id='11111111-1111-4111-8111-111111111111'
  ) THEN RAISE EXCEPTION 'ON DELETE CASCADE did not remove linked rows'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.wetudy_test_listing_photos
    WHERE listing_id='22222222-2222-4222-8222-222222222222'
  ) THEN RAISE EXCEPTION 'Cascade deleted a shared photo reference for another listing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.wetudy_test_listing_drafts
    WHERE photos @> '[{"url":"https://test.invalid/shared.webp"}]'::jsonb
  ) THEN RAISE EXCEPTION 'Draft reference not found by JSONB containment'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.wetudy_test_listings
    WHERE photos @> ARRAY['https://test.invalid/shared.webp']::text[]
  ) THEN RAISE EXCEPTION 'Published shared URL not found by array containment'; END IF;
END $assert$;

-- Wrong owner yields 0 deleted rows. APIs must check RETURNING before storage GC.
DO $assert$
DECLARE n integer;
BEGIN
 DELETE FROM public.wetudy_test_listings
  WHERE id='33333333-3333-4333-8333-333333333333'
    AND seller_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 0 THEN RAISE EXCEPTION 'Wrong owner deleted a listing'; END IF;
END $assert$;

-- Archiving must leave photos and listing row available for history.
UPDATE public.wetudy_test_listings SET status='archived'
 WHERE id='22222222-2222-4222-8222-222222222222';
DO $assert$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.wetudy_test_listing_photos p JOIN public.wetudy_test_listings l
  ON p.listing_id=l.id WHERE l.status='archived'
 ) THEN RAISE EXCEPTION 'Archive lost its photo rows'; END IF;
END $assert$;

-- Orphan file is only a cleanup candidate when its last DB reference disappears.
DELETE FROM public.wetudy_test_listings
 WHERE id='33333333-3333-4333-8333-333333333333';
DO $assert$
BEGIN
 IF EXISTS (
 SELECT 1 FROM public.wetudy_test_listing_photos
 WHERE url='https://test.invalid/orphan.webp'
 ) OR EXISTS (
 SELECT 1 FROM public.wetudy_test_listings
 WHERE photos @> ARRAY['https://test.invalid/orphan.webp']::text[]
 ) THEN RAISE EXCEPTION 'Deleted listing left a DB photo reference'; END IF;
END $assert$;
ROLLBACK; -- do not leave test data, even in ephemeral PostgreSQL
