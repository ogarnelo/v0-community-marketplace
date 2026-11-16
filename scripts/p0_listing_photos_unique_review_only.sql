-- WETUDY P0 / REVIEW ONLY / NOT AUTHORIZED FOR PRODUCTION EXECUTION
-- PG17. Use only after explicit operator approval and fresh preflight.
-- Guarantees unique (listing_id, url) for nonnull listing_id, preventing
-- duplicated photo rows when two independent browser sessions repair photos.
-- Takes a brief write-blocking table lock; SET LOCAL lock_timeout fails closed.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
LOCK TABLE public.listing_photos IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'P0_PHOTO_UNIQUE_NO_GO: PostgreSQL 17 required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'listing_photos'
      AND c.relkind = 'r' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'P0_PHOTO_UNIQUE_NO_GO: expected public.listing_photos with RLS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.listing_photos'::regclass
      AND attname = 'listing_id' AND atttypid = 'uuid'::regtype
      AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.listing_photos'::regclass
      AND attname = 'url' AND atttypid = 'text'::regtype
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'P0_PHOTO_UNIQUE_NO_GO: listing_id/url schema drift';
  END IF;
  IF to_regclass('public.listing_photos_listing_url_unique') IS NOT NULL THEN
    RAISE EXCEPTION 'P0_PHOTO_UNIQUE_NO_GO: index name already in use; inspect, do not silently skip';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.listing_photos
    WHERE listing_id IS NOT NULL
    GROUP BY listing_id, url HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'P0_PHOTO_UNIQUE_NO_GO: duplicate listing/photo URLs need manual reconciliation';
  END IF;
END $$;

CREATE UNIQUE INDEX listing_photos_listing_url_unique
  ON public.listing_photos (listing_id, url)
  WHERE listing_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    WHERE idx.oid = 'public.listing_photos_listing_url_unique'::regclass
      AND i.indrelid = 'public.listing_photos'::regclass
      AND i.indisunique AND i.indisvalid AND i.indisready
      AND pg_get_indexdef(i.indexrelid) =
        'CREATE UNIQUE INDEX listing_photos_listing_url_unique ON public.listing_photos USING btree (listing_id, url) WHERE (listing_id IS NOT NULL)'
  ) THEN
    RAISE EXCEPTION 'P0_PHOTO_UNIQUE_NO_GO: expected exact unique index not verified';
  END IF;
END $$;
COMMIT;
