-- REVIEW ONLY. Do not apply before explicit production DDL authorization.
-- Both operational school_id and national directory_school_code are guarded;
-- changes to existing listings not touching their school context remain possible.
-- Designed for authenticated owner writes, no new browser grants.
CREATE OR REPLACE FUNCTION private.enforce_listing_school_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  actor uuid := auth.uid();
  admin_count integer;
BEGIN
  -- Preserve old attributions during ordinary edits, even after student changes.
  IF TG_OP = 'UPDATE'
     AND NEW.school_id IS NOT DISTINCT FROM OLD.school_id
     AND NEW.directory_school_code IS NOT DISTINCT FROM OLD.directory_school_code
  THEN RETURN NEW; END IF;

  -- Unattributed general material is allowed.
  IF NEW.school_id IS NULL AND NEW.directory_school_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- Never allow a caller to associate an item to two distinct school sources.
  IF NEW.school_id IS NOT NULL AND NEW.directory_school_code IS NOT NULL THEN
    RAISE EXCEPTION 'Colegio no autorizado' USING ERRCODE = '42501';
  END IF;

  -- Server uses an authenticated service-role JWT, not user-provided JSON.
  IF auth.jwt() ->> 'role' = 'service_role' THEN RETURN NEW; END IF;

  IF actor IS NULL OR NEW.seller_id IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'Colegio no autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO admin_count
    FROM public.user_roles r
   WHERE r.user_id = actor AND r.role = 'school_admin';

  IF NEW.school_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.schools s
                   WHERE s.id = NEW.school_id AND s.is_active = true) THEN
      RAISE EXCEPTION 'Colegio no autorizado' USING ERRCODE = '42501';
    END IF;

    -- A school administrator may publish only for exactly one managed school.
    IF admin_count = 1 AND EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = actor
        AND r.role = 'school_admin' AND r.school_id = NEW.school_id
    ) THEN RETURN NEW; END IF;

    IF admin_count = 0 AND EXISTS (
      SELECT 1 FROM public.account_students a
      WHERE a.owner_user_id = actor AND a.active = true
        AND a.school_id = NEW.school_id AND a.directory_school_code IS NULL
    ) THEN RETURN NEW; END IF;

    -- Profile fallback is never used when any active student exists.
    IF admin_count = 0
       AND NOT EXISTS (
         SELECT 1 FROM public.account_students a
         WHERE a.owner_user_id = actor AND a.active = true
       )
       AND EXISTS (
         SELECT 1 FROM public.profiles p
         WHERE p.id = actor AND p.school_id = NEW.school_id
       ) THEN RETURN NEW; END IF;

  ELSIF NEW.directory_school_code IS NOT NULL THEN
    -- Never infer affiliation from a postcode/province or old profile.school_id.
    IF admin_count = 0
       AND EXISTS (SELECT 1 FROM public.school_directory d
                   WHERE d.official_code = NEW.directory_school_code
                     AND d.is_listed = true)
       AND EXISTS (SELECT 1 FROM public.account_students a
                   WHERE a.owner_user_id = actor AND a.active = true
                     AND a.directory_school_code = NEW.directory_school_code
                     AND a.school_id IS NULL)
    THEN RETURN NEW; END IF;
  END IF;

  RAISE EXCEPTION 'Colegio no autorizado' USING ERRCODE = '42501';
END;
$fn$;

REVOKE ALL ON FUNCTION private.enforce_listing_school_context()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_listing_school_context ON public.listings;
CREATE TRIGGER validate_listing_school_context
  BEFORE INSERT OR UPDATE OF school_id, directory_school_code
  ON public.listings
  FOR EACH ROW EXECUTE FUNCTION private.enforce_listing_school_context();
