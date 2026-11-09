-- WETUDY SCHOOL LINKING P0: deployment candidate, NOT an applied migration.
-- Only release through an approved, versioned Supabase migration after
-- preflight, backups and review. Until then use for ISOLATED LOCAL CI ONLY.
-- Tested against the original AuthForm -> GoTrue -> original QR browser flow.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

-- Do not silently change or unlink any family: fail closed on invalid legacy
-- assignments, so a rollout cannot imply that old data has already been fixed.
DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.school_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.schools s
        WHERE s.id = p.school_id AND s.is_active IS TRUE
      )
  ) THEN
    RAISE EXCEPTION 'school_guard_preflight_invalid_profiles';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.enforce_active_profile_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $guard$
BEGIN
  -- Unlinking (NULL) is always allowed. A pre-existing link may become
  -- inactive later; allow unrelated profile edits without revalidating it.
  IF (TG_OP = 'INSERT'
      OR NEW.school_id IS DISTINCT FROM OLD.school_id)
     AND NEW.school_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.schools s
       WHERE s.id = NEW.school_id AND s.is_active IS TRUE
     )
  THEN
    RAISE EXCEPTION 'school_unavailable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$guard$;

-- A trigger function is not an RPC. Restrict direct invocation, keep the
-- trigger itself SECURITY INVOKER and never bypass row-level policies.
REVOKE ALL ON FUNCTION public.enforce_active_profile_school()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS active_profile_school_guard ON public.profiles;
CREATE TRIGGER active_profile_school_guard
BEFORE INSERT OR UPDATE OF school_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_profile_school();
COMMIT;
