-- WETUDY pilot P0 #375: reusable read-only aggregate operational snapshot.
-- Does not access user, identity, message, recipient or email rows/values.
-- Run with SQL read-only privileges. No operational change is authorized.
BEGIN TRANSACTION READ ONLY;
WITH
  scoped_tables(table_name) AS (
    VALUES ('saved_searches'), ('saved_search_matches'),
      ('user_marketplace_preferences'), ('profiles'), ('listings'),
      ('listing_photos'), ('schools'), ('school_codes'),
      ('school_access_codes'), ('user_roles'), ('notifications')
  ),
  checked_roles(role_name) AS (VALUES ('anon'), ('authenticated')),
  checked_permissions(privilege_name) AS (
    VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
  ),
  grants AS (
    SELECT count(*) FILTER (
      WHERE has_table_privilege(
        role_name, ('public.' || table_name)::regclass, privilege_name
      )
    )::int AS sensitive_grant_cells
    FROM scoped_tables CROSS JOIN checked_roles CROSS JOIN checked_permissions
  )
SELECT
  (SELECT count(*)::int FROM public.listings WHERE is_demo IS TRUE)
    AS demo_listings,
  (SELECT count(*)::int FROM public.marketplace_alert_outbox)
    AS outbox_rows,
  (SELECT count(*)::int FROM public.schools
   WHERE is_active IS TRUE AND is_test IS TRUE)
    AS active_test_schools,
  (SELECT count(*)::int FROM public.schools
   WHERE is_active IS TRUE AND is_test IS DISTINCT FROM TRUE)
    AS active_non_test_schools,
  (SELECT count(*)::int FROM public.school_directory
   WHERE is_listed OR seo_indexable OR linked_school_id IS NOT NULL)
    AS active_directory_links,
  (SELECT count(*)::int FROM public.school_directory)
    AS school_directory_rows,
  (SELECT count(*)::int FROM pg_policies)
    AS total_rls_policies,
  grants.sensitive_grant_cells
FROM grants;
COMMIT;
