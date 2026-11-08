-- Disposable PostgreSQL on Supabase CLI localhost only.
-- Exact production server page reads these minimum-shaped data tables.
-- All names, emails, schools and contents below are synthetic.
CREATE TABLE public.schools (
 id uuid PRIMARY KEY, name text, city text, region text,
 postal_code text, school_type text, is_active boolean DEFAULT true
);
CREATE TABLE public.profiles (
 id uuid PRIMARY KEY, full_name text, school_id uuid
);
CREATE TABLE public.user_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,role text,school_id uuid
);
CREATE TABLE public.listings (
 id uuid PRIMARY KEY,title text,category text,grade_level text,price numeric,
 original_price numeric,estimated_retail_price numeric,isbn text,type text,status text,
 condition text,seller_id uuid,school_id uuid,created_at timestamptz DEFAULT now()
);
CREATE TABLE public.school_access_codes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid,
 code text,is_active boolean DEFAULT true,created_at timestamptz DEFAULT now()
);
CREATE TABLE public.account_students (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id uuid,school_id uuid,active boolean DEFAULT true
);
CREATE TABLE public.donation_requests (
 id uuid PRIMARY KEY, listing_id uuid,requester_id uuid,assigned_to_requester_id uuid,
 approved_by_admin_id uuid,status text,note text,created_at timestamptz,
 updated_at timestamptz,school_id uuid
);
CREATE TABLE public.agreements (
 id uuid PRIMARY KEY,listing_id uuid,agreement_type text,status text,
 amount numeric,confirmed_at timestamptz,created_at timestamptz,school_id uuid
);
CREATE TABLE public.reports (
 id uuid PRIMARY KEY,target_type text,listing_id uuid,conversation_id uuid,
 reason text,status text,created_at timestamptz
);
CREATE TABLE public.listing_views (
 id uuid PRIMARY KEY,listing_id uuid,viewed_at timestamptz
);
CREATE TABLE public.school_impact_report_subscriptions (
 id uuid PRIMARY KEY,school_id uuid,user_id uuid,enabled boolean,email text,
 day_of_month int,last_sent_month text
);
CREATE TABLE public.school_impact_report_deliveries (
 id uuid PRIMARY KEY,school_id uuid,email text,period_key text,period_label text,
 source text,sent_at timestamptz
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_profile_self ON public.profiles FOR SELECT TO authenticated
 USING (id=(select auth.uid()));
CREATE POLICY qa_role_self ON public.user_roles FOR SELECT TO authenticated
 USING (user_id=(select auth.uid()));
GRANT SELECT ON public.profiles,public.user_roles TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO public.schools(id,name,city,region,is_active) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','COLEGIO QA ALFA','Ciudad QA','Región QA',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','COLEGIO QA BETA','Ciudad QA','Región QA',true),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','COLEGIO QA GAMMA','Ciudad QA','Región QA',true);
INSERT INTO public.listings(id,title,school_id,status) VALUES
 ('11111111-1111-4111-8111-111111111111','LIBRO EXCLUSIVO ALFA','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','available'),
 ('22222222-2222-4222-8222-222222222222','LIBRO EXCLUSIVO BETA','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','available'),
 ('33333333-3333-4333-8333-333333333333','LIBRO EXCLUSIVO GAMMA','dddddddd-dddd-4ddd-8ddd-dddddddddddd','available');
INSERT INTO public.school_access_codes(school_id,code,is_active) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','QA-CODIGO-ALFA',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','QA-CODIGO-BETA',true),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','QA-CODIGO-GAMMA',true);
INSERT INTO public.reports(id,target_type,listing_id,reason,status,created_at) VALUES
 ('44444444-4444-4444-8444-444444444441','listing','11111111-1111-4111-8111-111111111111','RAZON RESERVADA ALFA','open',now()),
 ('44444444-4444-4444-8444-444444444442','listing','22222222-2222-4222-8222-222222222222','RAZON RESERVADA BETA','open',now()),
 ('44444444-4444-4444-8444-444444444443','listing','33333333-3333-4333-8333-333333333333','RAZON RESERVADA GAMMA','open',now());
-- Actual production function source installed after tables and before identities.
