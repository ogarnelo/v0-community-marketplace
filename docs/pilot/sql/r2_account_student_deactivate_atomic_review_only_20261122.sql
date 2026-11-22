-- REVIEW ONLY: do not apply to hosted Supabase without separate authorization.
-- Transactional replacement for the two separate account_students UPDATE calls.
-- No table alterations or production data changes. Invoker = service_role only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.r2_deactivate_student_and_promote_candidate(
 p_owner_user_id uuid, p_student_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $wetudy$
DECLARE
 v_type text;
 v_target record;
 v_next_id uuid;
 v_rows integer;
BEGIN
 IF p_owner_user_id IS NULL OR p_student_id IS NULL THEN RETURN false; END IF;
 -- Serialize same-owner transitions and deletion operations using a profile lock.
 SELECT user_type INTO v_type FROM public.profiles
 WHERE id=p_owner_user_id FOR UPDATE;
 IF NOT FOUND OR v_type IS DISTINCT FROM 'parent' THEN RETURN false; END IF;
 SELECT id,relationship,is_primary INTO v_target FROM public.account_students
 WHERE id=p_student_id AND owner_user_id=p_owner_user_id AND active=true
 FOR UPDATE;
 IF NOT FOUND OR v_target.relationship IS DISTINCT FROM 'guardian' THEN RETURN false; END IF;
 UPDATE public.account_students
 SET active=false,is_primary=false,updated_at=now()
 WHERE id=v_target.id AND owner_user_id=p_owner_user_id AND active=true
   AND relationship='guardian' AND is_primary=v_target.is_primary;
 GET DIAGNOSTICS v_rows=ROW_COUNT;
 IF v_rows<>1 THEN RAISE EXCEPTION 'R2_STUDENT_STATE_CHANGED'; END IF;
 IF v_target.is_primary THEN
   SELECT id INTO v_next_id FROM public.account_students
   WHERE owner_user_id=p_owner_user_id AND active=true AND relationship='guardian'
   ORDER BY sort_order,created_at,id LIMIT 1 FOR UPDATE;
   IF v_next_id IS NOT NULL THEN
     UPDATE public.account_students SET is_primary=true,updated_at=now()
     WHERE id=v_next_id AND owner_user_id=p_owner_user_id AND active=true
       AND relationship='guardian' AND is_primary=false;
     GET DIAGNOSTICS v_rows=ROW_COUNT;
     IF v_rows<>1 THEN RAISE EXCEPTION 'R2_PRIMARY_REASSIGN_FAILED'; END IF;
   END IF;
 END IF;
 RETURN true;
END
$wetudy$;
REVOKE ALL ON FUNCTION public.r2_deactivate_student_and_promote_candidate(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.r2_deactivate_student_and_promote_candidate(uuid,uuid)
 TO service_role;
DO $guard$
BEGIN
 IF has_function_privilege('anon','public.r2_deactivate_student_and_promote_candidate(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.r2_deactivate_student_and_promote_candidate(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.r2_deactivate_student_and_promote_candidate(uuid,uuid)','EXECUTE')
 OR (SELECT prosecdef FROM pg_proc WHERE oid='public.r2_deactivate_student_and_promote_candidate(uuid,uuid)'::regprocedure)
 THEN RAISE EXCEPTION 'R2_ACL_INVOKER_GUARD_FAILED'; END IF;
END $guard$;
COMMIT;
-- Deliberately NOT in supabase/migrations. No account route calls this RPC
-- until authorized deployment and verified postflight. Function does not
-- make the cross-system Auth metadata update atomic; that is a separate gate.
