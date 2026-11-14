-- Disposable PostgreSQL 17 ONLY: re-create the 36-column surface synthetically
-- around earlier fixtures. Transaction fully rolled back; no production SQL.
BEGIN;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS school_id uuid;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS grade_level text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS listing_type text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS estimated_retail_price numeric;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS isbn text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS author text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS publisher text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS format text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS seller_id uuid;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS original_price numeric;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS photos text[];
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS specific_type text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS size_label text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS book_edition_id uuid;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS directory_school_code text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS is_demo boolean;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS savings_amount numeric;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS lng double precision;
GRANT SELECT ON TABLE public.listings TO authenticated, service_role;
\i scripts/pilot-auth-listings-sensitive-grants-proposal.sql

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM postal_code, lat, lng FROM public.listings LIMIT 1;
    RAISE EXCEPTION 'Full postcode and coordinates remain readable to authenticated';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.listings LIMIT 1;
    RAISE EXCEPTION 'SELECT star should be blocked after column grants';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM id, seller_id, status, title, is_demo FROM public.listings LIMIT 1;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: authenticated can read catalog fields but not CP, lat, lng or SELECT star' AS result;
