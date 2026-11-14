-- PHASE 2: exact SELECT-only proposed migration on disposable local Supabase CLI.
-- This follows (does not replace) phase-1 "write-denied" fixture. Hosted credentials refused by runner.
-- Recreates full production-shaped 36-column surface only in isolated local database.
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
-- Reset the synthetic phase-1 DML restrictions to the grants currently found in prod.
GRANT INSERT, UPDATE, DELETE ON public.listings TO anon, authenticated;
-- Exact anon and auth SELECT proposals from PR #438, including all 33 columns.
\i scripts/pilot-anon-listings-revoke-proposal.sql
\i scripts/pilot-auth-listings-sensitive-grants-proposal.sql
DO $$
BEGIN
 IF has_table_privilege('anon','public.listings','SELECT')
 OR has_table_privilege('authenticated','public.listings','SELECT')
 OR has_column_privilege('authenticated','public.listings','postal_code','SELECT')
 OR has_column_privilege('authenticated','public.listings','lat','SELECT')
 OR has_column_privilege('authenticated','public.listings','lng','SELECT')
 THEN RAISE EXCEPTION 'Exactly proposed SELECT ACLs were not applied'; END IF;
 IF NOT has_table_privilege('authenticated','public.listings','UPDATE')
 OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE')
 OR NOT has_table_privilege('anon','public.listings','UPDATE')
 THEN RAISE EXCEPTION 'SELECT-only proposal unexpectedly removed existing DML grants'; END IF;
END $$;
NOTIFY pgrst, 'reload schema';
