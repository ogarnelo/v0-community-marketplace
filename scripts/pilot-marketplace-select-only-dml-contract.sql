-- Disposable PostgreSQL17 ONLY. Simulates exact SELECT-only ACL effect.
-- Demonstrates that revoking SELECT does NOT revoke DML permissions.
-- RLS is an independent authorization gate; this test does not assert DML safety.
BEGIN;
-- Build the 36-column synthetic shape inside ROLLBACK, like the established auth grants fixture.
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
GRANT SELECT,INSERT,UPDATE,DELETE ON public.listings TO anon, authenticated;
GRANT SELECT ON public.listings TO service_role;

DO $$
BEGIN
  IF NOT has_table_privilege('anon','public.listings','UPDATE')
     OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE')
  THEN RAISE EXCEPTION 'Synthetic baseline lacks expected DML grants'; END IF;
END $$;

-- Exactly the two review-only proposal operations affecting listings SELECT.
-- Do NOT copy fixture from PR #443: it deliberately changes UPDATE/INSERT
-- and is *not* representative of the proposed production migration.
REVOKE SELECT ON TABLE public.listings FROM anon;
REVOKE SELECT ON TABLE public.listings FROM authenticated;
GRANT SELECT (
 id,school_id,user_id,title,description,category,grade_level,condition,
 listing_type,price,estimated_retail_price,status,isbn,author,publisher,
 format,language,created_at,updated_at,seller_id,type,original_price,
 photos,subject,specific_type,size_label,brand,model,season,
 book_edition_id,directory_school_code,is_demo,savings_amount
) ON TABLE public.listings TO authenticated;

DO $$
BEGIN
  IF has_table_privilege('anon','public.listings','SELECT')
     OR has_table_privilege('authenticated','public.listings','SELECT')
     OR has_column_privilege('authenticated','public.listings','postal_code','SELECT')
  THEN RAISE EXCEPTION 'Proposed SELECT privacy restriction not effective'; END IF;

  IF NOT has_table_privilege('anon','public.listings','INSERT')
     OR NOT has_table_privilege('anon','public.listings','UPDATE')
     OR NOT has_table_privilege('anon','public.listings','DELETE')
  THEN RAISE EXCEPTION 'Unexpected change to anon DML grants'; END IF;

  IF NOT has_table_privilege('authenticated','public.listings','INSERT')
     OR NOT has_table_privilege('authenticated','public.listings','UPDATE')
     OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE')
  THEN RAISE EXCEPTION 'Unexpected change to auth owner DML grants'; END IF;

  IF NOT has_column_privilege('authenticated','public.listings','id','SELECT')
    OR NOT has_table_privilege('service_role','public.listings','SELECT')
  THEN RAISE EXCEPTION 'Required listing reads lost'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: SELECT-only migration preserves DML grants; separate RLS and anon DML hardening gates remain open' AS result;
