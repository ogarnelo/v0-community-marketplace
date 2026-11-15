-- PostgreSQL17 synthetic-only assertion for #447 AFTER executing proposal exactly.
\set ON_ERROR_STOP on
DO $$
BEGIN
 IF current_database() <> 'wetudy_privacy_ci' THEN
   RAISE EXCEPTION 'Refusing non-CI database';
 END IF;
 IF has_table_privilege('anon','public.listings','SELECT')
   OR has_column_privilege('anon','public.listings','postal_code','SELECT')
   OR has_column_privilege('anon','public.listings','lat','SELECT')
   OR has_column_privilege('anon','public.listings','lng','SELECT')
   OR has_column_privilege('anon','public.listings','seller_id','SELECT')
   OR has_column_privilege('anon','public.listings','user_id','SELECT') THEN
   RAISE EXCEPTION 'Anonymous privacy exposure remains';
 END IF;
 -- Critical finding #447: proposal revokes SELECT only; DML grants unchanged.
 IF NOT has_table_privilege('anon','public.listings','UPDATE') THEN
   RAISE EXCEPTION 'Unexpected anon DML change; risk analysis invalid';
 END IF;
 IF NOT has_table_privilege('authenticated','public.listings','INSERT')
   OR NOT has_table_privilege('authenticated','public.listings','UPDATE')
   OR NOT has_column_privilege('authenticated','public.listings','postal_code','INSERT')
   OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE') THEN
   RAISE EXCEPTION 'Authenticated postcode DML contract broken';
 END IF;
 IF NOT has_table_privilege('service_role','public.listings','SELECT') THEN
   RAISE EXCEPTION 'Service feed reader access broken';
 END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
        AND tablename='listings' AND policyname IN ('own_update','own_insert')) <> 2 THEN
   RAISE EXCEPTION 'Expected owner policies unexpectedly changed';
 END IF;
END $$;
\echo PASS_CI_PG17_PRIVACY_GRANTS: anon SELECT revoked; original UPDATE remains; authenticated CP INSERT/UPDATE preserved; service SELECT preserved; RLS policies unchanged.
