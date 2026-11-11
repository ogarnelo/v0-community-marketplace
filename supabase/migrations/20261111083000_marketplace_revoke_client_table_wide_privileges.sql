-- WETUDY pilot P0 #375: minimal table-wide privilege hardening.
-- Repository migration only. Do NOT apply until recovery/rollback is approved.
-- PostgreSQL 17 verified in Supabase Education Marketplace (2026-11-11).
--
-- PostgreSQL RLS does not cover TRUNCATE and REFERENCES; the Data API does
-- not require TRUNCATE, REFERENCES, TRIGGER or MAINTAIN. Client data
-- SELECT/INSERT/UPDATE/DELETE grants remain untouched, including the
-- owner-restricted DELETE for saved_search_matches.
BEGIN;

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.saved_searches,
           public.saved_search_matches,
           public.user_marketplace_preferences
  FROM anon, authenticated;

DO $wetudy$
DECLARE
  t text;
  role_name text;
  privilege_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'saved_searches','saved_search_matches','user_marketplace_preferences'
  ] LOOP
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
        IF has_table_privilege(role_name,'public.'||t,privilege_name) THEN
          RAISE EXCEPTION 'P0 broad table privilege remains: %.% %',
            t,role_name,privilege_name;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END
$wetudy$;

COMMIT;
