-- WETUDY #787: ONLY disposable Supabase CLI localhost postgres with PGAPPNAME guard.
-- This is not a migration. Every row, user, school and transaction is synthetic.
DO $guard$
BEGIN
 IF current_database() <> 'postgres'
    OR current_setting('application_name') <> 'wetudy_disposable_next_browser_20261120' THEN
   RAISE EXCEPTION 'Refuse non-disposable Supabase CLI Next browser fixture';
 END IF;
END $guard$;

CREATE TABLE public.schools (
  id uuid PRIMARY KEY, name text NOT NULL, city text,
  is_active boolean NOT NULL DEFAULT true, is_test boolean NOT NULL DEFAULT false
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, full_name text, school_id uuid, postal_code text
);
CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, query text
);
CREATE TABLE public.demand_requests (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL, title text
);
CREATE TABLE public.agreements (
  id uuid PRIMARY KEY, buyer_id uuid NOT NULL, seller_id uuid NOT NULL, status text
);
-- Actual route selects these listing columns, including empty nullable fields.
CREATE TABLE public.listings (
  id uuid PRIMARY KEY, title text, description text, category text,
  grade_level text, condition text, type text, listing_type text,
  isbn text, author text, publisher text, format text, language text,
  subject text, specific_type text, size_label text, brand text,
  model text, season text, price numeric, original_price numeric,
  estimated_retail_price numeric, seller_id uuid, user_id uuid,
  school_id uuid, directory_school_code text, postal_code text,
  status text, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.listing_photos (
  id uuid PRIMARY KEY, listing_id uuid, url text, sort_order integer
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;
-- Anonymous users have initial table GRANTs but NO applicable SELECT policies.
-- After REVOKE, their HTTP API must fail with 42501 instead of returning [].
CREATE POLICY wetudy_local_school_auth ON public.schools FOR SELECT TO authenticated
  USING (is_active);
CREATE POLICY wetudy_local_profile_self ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY wetudy_local_saved_self ON public.saved_searches FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY wetudy_local_demand_self ON public.demand_requests FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));
CREATE POLICY wetudy_local_agreement_participants ON public.agreements
  FOR SELECT TO authenticated
  USING (buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid()));

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.schools,public.profiles,public.saved_searches,
  public.demand_requests,public.agreements TO anon,authenticated,service_role;
GRANT SELECT ON public.listings,public.listing_photos TO service_role;

INSERT INTO public.schools(id,name,city,is_active,is_test) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','COLEGIO QA DELTA','Ciudad ficticia',true,false),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','COLEGIO QA OCULTO','Ciudad ficticia',false,false),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','COLEGIO QA PRUEBA','Ciudad ficticia',true,true);
NOTIFY pgrst, 'reload schema';
