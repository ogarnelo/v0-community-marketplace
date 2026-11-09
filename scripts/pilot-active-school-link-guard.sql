-- QA-ONLY PROPOSAL. Must be reviewed and migrated separately before production.
-- Reproduces the intended school-activation guard for direct PostgREST profile
-- writes, in addition to the existing validation in the original QR page.
-- Uses SECURITY INVOKER and the caller's existing SELECT grant/RLS on schools;
-- never grants any new privilege and never activates an actual school.
CREATE OR REPLACE FUNCTION public.qa_enforce_active_profile_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $qa$
DECLARE
  changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    changed := true;
  ELSE
    changed := NEW.school_id IS DISTINCT FROM OLD.school_id;
  END IF;
  IF changed AND NEW.school_id IS NOT NULL
     AND NOT EXISTS(
       SELECT 1 FROM public.schools s
       WHERE s.id = NEW.school_id AND s.is_active IS TRUE
     )
  THEN
    RAISE EXCEPTION 'school_unavailable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$qa$;
REVOKE ALL ON FUNCTION public.qa_enforce_active_profile_school()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS qa_active_school_on_profile ON public.profiles;
CREATE TRIGGER qa_active_school_on_profile
BEFORE INSERT OR UPDATE OF school_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.qa_enforce_active_profile_school();
