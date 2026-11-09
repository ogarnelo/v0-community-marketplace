-- Disposable Supabase CLI postgres ONLY. No production users, no hosted SMTP.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  first_name text,last_name text,full_name text,user_type text,
  grade_level text,postal_code text,school_id uuid
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_email_profile_select ON public.profiles FOR SELECT TO authenticated
USING (id=(SELECT auth.uid()));
CREATE POLICY qa_email_profile_insert ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id=(SELECT auth.uid()));
CREATE POLICY qa_email_profile_update ON public.profiles FOR UPDATE TO authenticated
USING (id=(SELECT auth.uid())) WITH CHECK (id=(SELECT auth.uid()));
GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;

-- The real app callback records acquisition using the real service-role client.
CREATE TABLE public.growth_acquisition_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text, user_id uuid,
  source text,medium text,campaign text,content text,landing_path text
);
ALTER TABLE public.growth_acquisition_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.growth_acquisition_events TO service_role;
