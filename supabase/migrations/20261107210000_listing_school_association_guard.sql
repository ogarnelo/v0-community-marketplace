-- Prevent users from attributing listings to arbitrary schools.
-- Existing listings remain editable even after a family's student changes schools
-- (only a NEW school association is validated). No existing row is rewritten.
CREATE OR REPLACE FUNCTION private.enforce_listing_school_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF NEW.school_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.school_id IS NOT DISTINCT FROM OLD.school_id THEN
    RETURN NEW;
  END IF;

  -- Trusted server-side actions use the service-role JWT.
  IF auth.jwt() ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF actor IS NULL OR NEW.seller_id IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'No puedes asociar este anuncio a ese colegio'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = actor AND r.role = 'school_admin' AND r.school_id = NEW.school_id
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.account_students a
    WHERE a.owner_user_id = actor AND a.active = true AND a.school_id = NEW.school_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Legacy account context is valid only if there are no active students.
  IF NOT EXISTS (
    SELECT 1 FROM public.account_students a
    WHERE a.owner_user_id = actor AND a.active = true
  ) AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = actor AND p.school_id = NEW.school_id
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'No puedes asociar este anuncio a ese colegio'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_listing_school_context()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_listing_school_context ON public.listings;
CREATE TRIGGER validate_listing_school_context
BEFORE INSERT OR UPDATE OF school_id
ON public.listings
FOR EACH ROW
EXECUTE FUNCTION private.enforce_listing_school_context();
