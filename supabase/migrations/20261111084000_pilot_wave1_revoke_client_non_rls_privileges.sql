-- WETUDY P0 #375 — wave 1 of client privilege hardening.
-- PREPARED ONLY: do not apply until recovery, dependencies and rollback approval.
-- Verified pre-change metadata: these eight tables have broad grants for
-- anon and authenticated on 2026-11-11. No row data is read or modified.
-- Keep SELECT / INSERT / UPDATE / DELETE and RLS policies unchanged.
BEGIN;

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE
    public.profiles,
    public.listings,
    public.listing_photos,
    public.schools,
    public.school_codes,
    public.school_access_codes,
    public.user_roles,
    public.notifications
  FROM anon, authenticated;

DO $wetudy$
DECLARE
  target text;
  client_role text;
  permission text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'profiles','listings','listing_photos','schools',
    'school_codes','school_access_codes','user_roles','notifications'
  ] LOOP
    IF to_regclass('public.'||target) IS NULL THEN
      RAISE EXCEPTION 'Missing wave-1 table: %',target;
    END IF;
    FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH permission IN ARRAY ARRAY[
        'TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'
      ] LOOP
        IF has_table_privilege(client_role,'public.'||target,permission) THEN
          RAISE EXCEPTION 'Wave-1 grant not revoked: %.% %',
             client_role,target,permission;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $wetudy$;
COMMIT;
