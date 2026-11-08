-- Identifies demo marketplace rows without reading personal data or joining other tables.
-- Matches lib/seo/demo-listing.ts; future reporting must filter is_demo = false.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_demo boolean
  GENERATED ALWAYS AS (
    id::text LIKE 'd0000000-0000-4000-8000-%'
    OR btrim(coalesce(title, '')) ~* '^demo[[:space:]]*[·:—-]'
  ) STORED;

CREATE INDEX IF NOT EXISTS listings_real_status_idx
  ON public.listings (status)
  WHERE is_demo = false;

COMMENT ON COLUMN public.listings.is_demo IS
  'Derived DEMO marker for reliable real-only analytics; not a publication/visibility flag or community permission.';
