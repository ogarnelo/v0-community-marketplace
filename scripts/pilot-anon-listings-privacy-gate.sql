-- WETUDY P0 | 14/11/2026 | only catalog metadata; no personal data returned.
-- Run on approved Supabase PostgreSQL. NO-GO means do not onboard real families.
BEGIN TRANSACTION READ ONLY;
WITH assessed(column_name) AS (
  VALUES ('postal_code'), ('seller_id'), ('user_id')
), exposures AS (
  SELECT column_name,
         has_column_privilege('anon','public.listings',column_name,'SELECT') AS anon_can_read,
         has_column_privilege('authenticated','public.listings',column_name,'SELECT') AS auth_can_read
  FROM assessed
)
SELECT column_name, anon_can_read, auth_can_read,
       CASE WHEN anon_can_read THEN 'NO_GO_PUBLIC_COLUMN' ELSE 'NO_DIRECT_ANON_COLUMN_PRIVILEGE' END AS gate
FROM exposures ORDER BY column_name;
SELECT CASE
 WHEN has_column_privilege('anon','public.listings','postal_code','SELECT')
   OR has_column_privilege('anon','public.listings','seller_id','SELECT')
   OR has_column_privilege('anon','public.listings','user_id','SELECT')
 THEN 'NO_GO_PRIVACY_REVIEW'
 ELSE 'PASS_DIRECT_COLUMN_PRIVILEGES_ONLY'
 END AS privacy_gate;
-- Note: PASS is only one gate; verify existing views, RPCs, RLS, API and UI.
ROLLBACK;
