-- WETUDY R3 / A-002 — REVIEW-ONLY ATOMIC DONATION REVIEW PROPOSAL
-- NOT A PRODUCTION MIGRATION. MUST NOT RUN ON SUPABASE WITHOUT NEW EXPLICIT
-- AUTHORIZATION, PRE/POSTFLIGHT, REVIEWED ROLLBACK, AND OWNER ACCEPTANCE.
-- Existing JS route stays LEGACY/OFF until the SQL is installed AND the
-- WETUDY_R3_DONATION_ATOMIC_REVIEW_ENABLED switch is explicitly activated.
-- This transaction protects the donation decision, competing pending requests
-- and listing archive; conversations/notifications remain post-commit effects
-- and require reconciliation on provider failure.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';

DO $preflight$
BEGIN
 IF to_regclass('public.donation_requests') IS NULL
    OR to_regclass('public.listings') IS NULL
    OR to_regclass('public.schools') IS NULL
    OR to_regclass('public.user_roles') IS NULL
    OR NOT EXISTS (
       SELECT 1 FROM pg_class c
       WHERE c.oid='public.donation_requests'::regclass AND c.relrowsecurity)
    OR NOT EXISTS (
       SELECT 1 FROM pg_index i
       WHERE i.indexrelid=to_regclass('public.donation_requests_one_approved_per_listing_idx')
         AND i.indisunique AND i.indisvalid AND i.indisready)
    OR NOT EXISTS (
       SELECT 1 FROM pg_index i
       WHERE i.indexrelid=to_regclass('public.donation_requests_one_pending_per_requester_listing_idx')
         AND i.indisunique AND i.indisvalid AND i.indisready)
 THEN
   RAISE EXCEPTION 'NO_GO_A002_SCHEMA_OR_EXISTING_GUARDS_DRIFTED';
 END IF;
 IF to_regprocedure('public.r3_review_donation_atomic(uuid,uuid,text,text)') IS NOT NULL THEN
   RAISE EXCEPTION 'NO_GO_A002_RPC_ALREADY_EXISTS';
 END IF;
END $preflight$;

CREATE FUNCTION public.r3_review_donation_atomic(
 p_actor_id uuid,
 p_request_id uuid,
 p_action text,
 p_note text DEFAULT NULL
)
RETURNS TABLE (
 request_id uuid,
 decision_status text,
 listing_id uuid,
 requester_id uuid,
 school_id uuid,
 seller_id uuid
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
 v_req public.donation_requests%ROWTYPE;
 v_listing public.listings%ROWTYPE;
 v_school_active boolean;
 v_super_count bigint;
 v_admin_count bigint;
 v_matching_admin_count bigint;
 v_now timestamptz := clock_timestamp();
BEGIN
 IF p_actor_id IS NULL OR p_request_id IS NULL
    OR p_action NOT IN ('approve','reject') OR p_action IS NULL THEN
    RAISE EXCEPTION 'R3_DONATION_INVALID_ACTION' USING ERRCODE='22023';
 END IF;
 -- Look up request ID without a lock to discover its listing. The listing is
 -- locked FIRST to serialize reviews of two DIFFERENT requests for one item.
 SELECT * INTO v_req
   FROM public.donation_requests AS dr WHERE dr.id=p_request_id;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'R3_DONATION_NOT_FOUND' USING ERRCODE='P0002';
 END IF;
 SELECT * INTO v_listing
   FROM public.listings AS li WHERE li.id=v_req.listing_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'R3_DONATION_LISTING_NOT_FOUND' USING ERRCODE='P0002';
 END IF;
 -- Re-read under lock. Even if a seller or another reviewer changed the
 -- request during the first read, no stale state is allowed to commit.
 SELECT * INTO v_req
   FROM public.donation_requests AS dr WHERE dr.id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.status IS DISTINCT FROM 'pending'
    OR v_req.listing_id IS DISTINCT FROM v_listing.id THEN
   RAISE EXCEPTION 'R3_DONATION_STATUS_CONFLICT' USING ERRCODE='P0001';
 END IF;
 IF v_req.school_id IS NULL OR v_req.requester_id IS NULL
    OR v_listing.school_id IS DISTINCT FROM v_req.school_id
    OR v_listing.listing_type IS DISTINCT FROM 'donation' THEN
   RAISE EXCEPTION 'R3_DONATION_CONTEXT_CONFLICT' USING ERRCODE='P0001';
 END IF;
 -- SHARE lock serializes school deactivation and this authorized decision.
 SELECT s.is_active INTO v_school_active
 FROM public.schools AS s WHERE s.id=v_req.school_id FOR SHARE;
 IF NOT FOUND OR v_school_active IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'R3_DONATION_SCHOOL_INACTIVE' USING ERRCODE='42501';
 END IF;
 -- User identity has been checked by Auth before service_role RPC invocation,
 -- but revalidate the CURRENT school grant inside the same DB transaction.
 SELECT COUNT(*) FILTER (WHERE r.role='super_admin'),
        COUNT(*) FILTER (WHERE r.role='school_admin'),
        COUNT(*) FILTER (WHERE r.role='school_admin'
                          AND r.school_id=v_req.school_id)
 INTO v_super_count,v_admin_count,v_matching_admin_count
 FROM public.user_roles AS r WHERE r.user_id=p_actor_id;
 IF v_super_count=0 AND
    (v_admin_count<>1 OR v_matching_admin_count<>1) THEN
    RAISE EXCEPTION 'R3_DONATION_ROLE_SCOPE_DENIED' USING ERRCODE='42501';
 END IF;
 IF p_action='approve' THEN
   IF v_listing.status IS DISTINCT FROM 'available' THEN
     RAISE EXCEPTION 'R3_DONATION_STATUS_CONFLICT' USING ERRCODE='P0001';
   END IF;
   -- Existing unique index on (listing_id) WHERE status='approved' is retained
   -- and independently protects reviews racing the seller's legacy flow.
   UPDATE public.donation_requests AS dr SET
      status='approved',
      assigned_to_requester_id=v_req.requester_id,
      approved_by_admin_id=p_actor_id,
      note=NULLIF(left(btrim(coalesce(p_note,'')),600),''),
      updated_at=v_now
    WHERE dr.id=v_req.id AND dr.status='pending';
   IF NOT FOUND THEN
      RAISE EXCEPTION 'R3_DONATION_STATUS_CONFLICT' USING ERRCODE='P0001';
   END IF;
   UPDATE public.listings AS li SET status='archived'
    WHERE li.id=v_listing.id AND li.status='available';
   IF NOT FOUND THEN
      RAISE EXCEPTION 'R3_DONATION_ARCHIVE_CONFLICT' USING ERRCODE='P0001';
   END IF;
   UPDATE public.donation_requests AS dr SET
      status='rejected',
      note='La donación ya fue asignada a otro solicitante.',
      updated_at=v_now
    WHERE dr.listing_id=v_listing.id AND dr.id<>v_req.id
      AND dr.status='pending';
 ELSE
   UPDATE public.donation_requests AS dr SET
      status='rejected',
      approved_by_admin_id=p_actor_id,
      note=NULLIF(left(btrim(coalesce(p_note,'')),600),''),
      updated_at=v_now
    WHERE dr.id=v_req.id AND dr.status='pending';
   IF NOT FOUND THEN
      RAISE EXCEPTION 'R3_DONATION_STATUS_CONFLICT' USING ERRCODE='P0001';
   END IF;
 END IF;
 request_id := v_req.id;
 decision_status := CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END;
 listing_id := v_listing.id;
 requester_id := v_req.requester_id;
 school_id := v_req.school_id;
 seller_id := v_listing.seller_id;
 RETURN NEXT;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.r3_review_donation_atomic(uuid,uuid,text,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.r3_review_donation_atomic(uuid,uuid,text,text)
 TO service_role;

DO $postflight$
DECLARE
 v_oid oid := to_regprocedure('public.r3_review_donation_atomic(uuid,uuid,text,text)')::oid;
BEGIN
 IF v_oid IS NULL
    OR (SELECT p.prosecdef FROM pg_proc p WHERE p.oid=v_oid)
    OR has_function_privilege('anon',v_oid,'EXECUTE')
    OR has_function_privilege('authenticated',v_oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'NO_GO_A002_RPC_ACL_OR_SECURITY_POSTFLIGHT';
 END IF;
END $postflight$;
COMMIT;
-- ROLLBACK, only with NEW OWNER AUTHORIZATION and exact ACL/function snapshot:
-- BEGIN; DROP FUNCTION public.r3_review_donation_atomic(uuid,uuid,text,text);
-- COMMIT; followed by ACL/RLS/index postflight. Never drop approved/pending
-- indexes or change ordinary table privileges as a side effect.
