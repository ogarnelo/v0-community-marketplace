-- Synthetic PostgreSQL17-only regression for #447.
-- Run ONLY in disposable CI database wetudy_privacy_ci.
-- The proposal must revoke anonymous SELECT without changing existing DML,
-- authenticated postcode INSERT/UPDATE, or service-role SELECT.
\set ON_ERROR_STOP on
DO $$
BEGIN
 IF current_database() <> 'wetudy_privacy_ci'
    OR inet_server_addr() IS NULL THEN
   RAISE EXCEPTION 'Refusing non-CI database';
 END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $;
CREATE TABLE public.listings (
 id bigint primary key,
 postal_code text,
 lat numeric,
 lng numeric,
 seller_id uuid,
 user_id uuid,
 status text
);
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_update ON public.listings
 FOR UPDATE TO authenticated USING (user_id=auth.uid())
 WITH CHECK (user_id=auth.uid());
CREATE POLICY own_insert ON public.listings
 FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
GRANT SELECT, UPDATE ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.listings TO authenticated;
GRANT SELECT ON public.listings TO service_role;
DO $$
BEGIN
 IF NOT has_table_privilege('anon','public.listings','SELECT')
    OR NOT has_table_privilege('anon','public.listings','UPDATE')
    OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE')
    OR NOT has_column_privilege('authenticated','public.listings','postal_code','INSERT')
    OR NOT has_table_privilege('service_role','public.listings','SELECT')
 THEN RAISE EXCEPTION 'Invalid synthetic starting grants'; END IF;
END $$;
\echo CI_PRIVACY_FIXTURE_READY
