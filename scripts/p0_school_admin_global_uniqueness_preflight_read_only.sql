-- WETUDY P0 school_admin exclusivity PRE-FLIGHT, SELECT ONLY, 2026-11-17.
-- Do not use SQL editor superuser roles to simulate authenticated application flows.
BEGIN READ ONLY;

SELECT
 (SELECT count(*) FROM public.user_roles WHERE role = 'school_admin') AS school_admin_roles,
 (SELECT count(*) FROM public.user_roles WHERE role = 'school_admin' AND school_id IS NULL) AS admin_null_school,
 (SELECT count(*) FROM (
   SELECT user_id FROM public.user_roles WHERE role = 'school_admin'
   GROUP BY user_id HAVING count(DISTINCT school_id) > 1
 ) x) AS users_admin_of_multiple_schools,
 (SELECT count(*) FROM (
   SELECT user_id FROM public.user_roles WHERE role = 'school_admin'
   GROUP BY user_id HAVING count(*) > 1
 ) x) AS users_with_multiple_school_admin_rows;

SELECT indexname,indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'user_roles'
ORDER BY indexname;

SELECT conname,contype,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid = 'public.user_roles'::regclass
ORDER BY conname;

COMMIT;
