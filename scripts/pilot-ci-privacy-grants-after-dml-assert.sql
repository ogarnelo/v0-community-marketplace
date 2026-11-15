-- Synthetic PG17 assertions AFTER SELECT and separate DML review proposals.
\set ON_ERROR_STOP on
DO $wetudy$
BEGIN
 IF current_database() <> 'wetudy_privacy_ci' THEN
   RAISE EXCEPTION 'Non-disposable database refused';
 END IF;
 IF has_table_privilege('anon','public.listings','SELECT')
   OR has_table_privilege('anon','public.listings','INSERT')
   OR has_table_privilege('anon','public.listings','UPDATE')
   OR has_table_privilege('anon','public.listings','DELETE') THEN
   RAISE EXCEPTION 'Anonymous listings privilege still exposed';
 END IF;
 IF NOT has_column_privilege('authenticated','public.listings','postal_code','INSERT')
   OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE')
   OR NOT has_table_privilege('authenticated','public.listings','INSERT')
   OR NOT has_table_privilege('authenticated','public.listings','UPDATE') THEN
   RAISE EXCEPTION 'Owner listing/postal-code DML grant changed';
 END IF;
 IF NOT has_table_privilege('service_role','public.listings','SELECT') THEN
   RAISE EXCEPTION 'Feed server role lost read access';
 END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
   AND tablename='listings' AND policyname IN ('own_update','own_insert')) <> 2 THEN
   RAISE EXCEPTION 'Owner RLS policies unexpectedly modified';
 END IF;
END $wetudy$;
\echo PASS_CI_ANON_DML_DEFENSE: no anon SELECT/INSERT/UPDATE/DELETE; authenticated postal-code INSERT/UPDATE retained; service SELECT retained.
