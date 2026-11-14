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

-- Extra P0: six actual production RLS policies reference listings:
-- conversations INSERT, four listing_photos operations and reports SELECT.
-- Test only required SELECT *columns*; role/identity policies are tested elsewhere.
-- All writes and new QA tables are within this disposable PG17 rollback transaction.
INSERT INTO public.listings(id,seller_id,school_id,status)
 VALUES ('97777777-7777-4777-8777-777777777771',
         '97777777-7777-4777-8777-777777777772',
         '97777777-7777-4777-8777-777777777773','available');
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_policy_dependency_available ON public.listings
 FOR SELECT TO authenticated USING (status='available');
GRANT USAGE ON SCHEMA public TO authenticated;

CREATE TABLE public.qa_dep_conversations (
 id uuid PRIMARY KEY,listing_id uuid,seller_id uuid
);
CREATE TABLE public.qa_dep_photos (
 id uuid PRIMARY KEY,listing_id uuid,seller_id uuid,url text
);
CREATE TABLE public.qa_dep_reports (
 id uuid PRIMARY KEY,listing_id uuid,school_id uuid
);
ALTER TABLE public.qa_dep_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_dep_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_dep_reports ENABLE ROW LEVEL SECURITY;
GRANT INSERT,SELECT ON public.qa_dep_conversations TO authenticated;
GRANT INSERT,SELECT,UPDATE ON public.qa_dep_photos TO authenticated;
GRANT SELECT ON public.qa_dep_reports TO authenticated;
CREATE POLICY qa_dep_convo_insert ON public.qa_dep_conversations
 FOR INSERT TO authenticated WITH CHECK (
 EXISTS(SELECT 1 FROM public.listings l
 WHERE l.id=listing_id AND l.seller_id=seller_id AND l.status='available')
);
CREATE POLICY qa_dep_convo_select ON public.qa_dep_conversations
 FOR SELECT TO authenticated USING (true);
CREATE POLICY qa_dep_photo_select ON public.qa_dep_photos
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.listings l WHERE l.id=listing_id)
);
CREATE POLICY qa_dep_photo_insert ON public.qa_dep_photos
 FOR INSERT TO authenticated WITH CHECK (
 EXISTS(SELECT 1 FROM public.listings l
 WHERE l.id=listing_id AND l.seller_id=seller_id)
);
CREATE POLICY qa_dep_photo_update ON public.qa_dep_photos
 FOR UPDATE TO authenticated USING (
 EXISTS(SELECT 1 FROM public.listings l
 WHERE l.id=listing_id AND l.seller_id=seller_id)
) WITH CHECK (
 EXISTS(SELECT 1 FROM public.listings l
 WHERE l.id=listing_id AND l.seller_id=seller_id)
);
CREATE POLICY qa_dep_reports_select ON public.qa_dep_reports
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.listings l
 WHERE l.id=listing_id AND l.school_id=school_id)
);
INSERT INTO public.qa_dep_reports
 VALUES ('97777777-7777-4777-8777-777777777774',
         '97777777-7777-4777-8777-777777777771',
         '97777777-7777-4777-8777-777777777773');
SET LOCAL ROLE authenticated;
INSERT INTO public.qa_dep_conversations VALUES (
 '97777777-7777-4777-8777-777777777775',
 '97777777-7777-4777-8777-777777777771',
 '97777777-7777-4777-8777-777777777772');
INSERT INTO public.qa_dep_photos VALUES (
 '97777777-7777-4777-8777-777777777776',
 '97777777-7777-4777-8777-777777777771',
 '97777777-7777-4777-8777-777777777772','qa-image');
UPDATE public.qa_dep_photos SET url='qa-image-updated'
 WHERE id='97777777-7777-4777-8777-777777777776';
DO $
BEGIN
 IF (SELECT count(*) FROM public.qa_dep_conversations)<>1
 OR (SELECT count(*) FROM public.qa_dep_reports)<>1
 OR (SELECT count(*) FROM public.qa_dep_photos
     WHERE url='qa-image-updated')<>1
 THEN RAISE EXCEPTION 'Owner-independent RLS column dependency contract failed'; END IF;
 IF has_column_privilege('authenticated','public.listings','postal_code','SELECT')
 OR has_column_privilege('authenticated','public.listings','lat','SELECT')
 OR has_column_privilege('authenticated','public.listings','lng','SELECT')
 THEN RAISE EXCEPTION 'Sensitive listing locations were leaked to authenticated'; END IF;
END $;
RESET ROLE;
-- Removing school_id now breaks the report RLS subquery even though reports
-- itself remains granted. This is why the 33-column projection must keep it.
REVOKE SELECT (school_id) ON public.listings FROM authenticated;
SET LOCAL ROLE authenticated;
DO $
BEGIN
 BEGIN
  PERFORM count(*) FROM public.qa_dep_reports;
  RAISE EXCEPTION 'Removing school_id did not break report policy as expected';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $;
RESET ROLE;
GRANT SELECT(school_id) ON public.listings TO authenticated;

ROLLBACK;
SELECT 'PASS: SELECT-only migration preserves DML grants; separate RLS and anon DML hardening gates remain open' AS result;
