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
-- Phase 1 already changed authenticated SELECT; restore the actual broad production
-- SELECT baseline before running the independent anon proposal precondition.
GRANT SELECT ON public.listings TO authenticated, service_role;
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

-- Phase 3: reproduce authenticated photo CRUD RLS dependencies on listings.
GRANT INSERT,UPDATE,DELETE ON public.listing_photos TO authenticated;
ALTER TABLE public.listing_photos ADD COLUMN IF NOT EXISTS sort_order integer;
CREATE POLICY qa_photo_insert_owner ON public.listing_photos FOR INSERT TO authenticated
 WITH CHECK (EXISTS(SELECT 1 FROM public.listings l
 WHERE l.id=listing_photos.listing_id AND l.seller_id=(SELECT auth.uid())));
CREATE POLICY qa_photo_update_owner ON public.listing_photos FOR UPDATE TO authenticated
 USING (EXISTS(SELECT 1 FROM public.listings l
 WHERE l.id=listing_photos.listing_id AND l.seller_id=(SELECT auth.uid())))
 WITH CHECK (EXISTS(SELECT 1 FROM public.listings l
 WHERE l.id=listing_photos.listing_id AND l.seller_id=(SELECT auth.uid())));
CREATE POLICY qa_photo_delete_owner ON public.listing_photos FOR DELETE TO authenticated
 USING (EXISTS(SELECT 1 FROM public.listings l
 WHERE l.id=listing_photos.listing_id AND l.seller_id=(SELECT auth.uid())));
-- Conversations policy in production references l.id, l.seller_id and l.status.
CREATE TABLE public.qa_privacy_conversations(
 id uuid PRIMARY KEY, listing_id uuid NOT NULL, seller_id uuid NOT NULL,
 buyer_id uuid NOT NULL
);
ALTER TABLE public.qa_privacy_conversations ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.qa_privacy_conversations TO authenticated;
CREATE POLICY qa_conversation_participant_read ON public.qa_privacy_conversations
 FOR SELECT TO authenticated USING (
 buyer_id=(SELECT auth.uid()) OR seller_id=(SELECT auth.uid()));
CREATE POLICY qa_conversation_buyer_insert ON public.qa_privacy_conversations
 FOR INSERT TO authenticated WITH CHECK (
 buyer_id=(SELECT auth.uid()) AND seller_id<>(SELECT auth.uid())
 AND EXISTS(SELECT 1 FROM public.listings l WHERE l.id=listing_id
 AND l.seller_id=qa_privacy_conversations.seller_id AND l.status='available'));
NOTIFY pgrst, 'reload schema';
