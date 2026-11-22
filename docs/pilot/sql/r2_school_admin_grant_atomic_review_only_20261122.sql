-- REVIEW ONLY — NEVER apply to hosted Supabase without a separate SQL authorization.
-- A single SECURITY INVOKER statement grants a school role and updates profile atomically.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.r2_grant_school_admin_atomic_candidate(
  p_user_id uuid, p_school_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $wetudy$
DECLARE
  v_active boolean;
  v_profile_id uuid;
  v_role_id uuid;
  v_profile_count integer;
BEGIN
  IF p_user_id IS NULL OR p_school_id IS NULL THEN RETURN false; END IF;
  -- Lock by profile to serialize grants for the same user within this path.
  SELECT id INTO v_profile_id FROM public.profiles
  WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT is_active INTO v_active FROM public.schools
  WHERE id=p_school_id;
  IF NOT FOUND OR v_active IS DISTINCT FROM true THEN RETURN false; END IF;

  -- Schools is SELECT-only for service_role: never require extra UPDATE grants.\n  -- The current dashboard supports exactly one school-admin school per user.
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=p_user_id AND role='school_admin'
      AND school_id IS DISTINCT FROM p_school_id
  ) THEN RETURN false; END IF;

  INSERT INTO public.user_roles (user_id,role,school_id)
  VALUES (p_user_id,'school_admin',p_school_id)
  ON CONFLICT DO NOTHING;

  -- A conflict from another constraint must not be mistaken for success.
  SELECT id INTO v_role_id FROM public.user_roles
  WHERE user_id=p_user_id AND role='school_admin' AND school_id=p_school_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'R2_SCHOOL_ADMIN_ROLE_UNCONFIRMED'; END IF;

  UPDATE public.profiles SET school_id=p_school_id
  WHERE id=p_user_id;
  GET DIAGNOSTICS v_profile_count=ROW_COUNT;
  IF v_profile_count<>1 THEN RAISE EXCEPTION 'R2_SCHOOL_ADMIN_PROFILE_UNCONFIRMED'; END IF;

  -- Fail closed if a conflicting role appeared outside the cooperating RPC.
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=p_user_id AND role='school_admin'
      AND school_id IS DISTINCT FROM p_school_id
  ) THEN RAISE EXCEPTION 'R2_SCHOOL_ADMIN_CONCURRENT_CONFLICT'; END IF;
  RETURN true;
END
$wetudy$;
REVOKE ALL ON FUNCTION public.r2_grant_school_admin_atomic_candidate(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.r2_grant_school_admin_atomic_candidate(uuid,uuid)
  TO service_role;
DO $guard$
BEGIN
  IF has_function_privilege('anon','public.r2_grant_school_admin_atomic_candidate(uuid,uuid)','EXECUTE')
  OR has_function_privilege('authenticated','public.r2_grant_school_admin_atomic_candidate(uuid,uuid)','EXECUTE')
  OR NOT has_function_privilege('service_role','public.r2_grant_school_admin_atomic_candidate(uuid,uuid)','EXECUTE')
  OR (SELECT prosecdef FROM pg_proc
      WHERE oid='public.r2_grant_school_admin_atomic_candidate(uuid,uuid)'::regprocedure)
  THEN RAISE EXCEPTION 'R2_SCHOOL_ADMIN_ACL_GUARD_FAILED'; END IF;
END $guard$;
COMMIT;
-- No migration, no database execution and no feature flag activation in this PR.
