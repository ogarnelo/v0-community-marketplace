-- WETUDY #591 · CANDIDATO DDL REVIEW ONLY · NO APLICAR SIN AUTORIZACIÓN EXPRESA
-- Nunca ejecutar en CI/Vercel/Supabase contra producción. La prueba GitHub solo lo ejecuta en PostgreSQL 17 desechable.
-- Requiere preflight read-only, aprobación independiente, prueba local y plan rollback.
-- Este bloque puede tomar bloqueo de índice; se debe revisar la duración prevista.
BEGIN;

DO $gate$
DECLARE
  p record;
  mismatches bigint;
  duplicate_approvals bigint;
  invalid_initial_state bigint;
BEGIN
  SELECT * INTO p FROM pg_policies WHERE schemaname='public'
    AND tablename='donation_requests' AND policyname='Users can create donation requests';
  IF NOT FOUND OR p.cmd <> 'INSERT' OR p.roles::text <> '{public}'
     OR regexp_replace(coalesce(p.with_check,''),'[[:space:]]+','','g')
       NOT IN ('((SELECTauth.uid()ASuid)=requester_id)','((SELECTauth.uid())=requester_id)') THEN
    RAISE EXCEPTION 'NO_GO_591: original INSERT policy drifted; stop for human review';
  END IF;

  SELECT count(*) INTO mismatches FROM public.donation_requests dr
  JOIN public.listings l ON l.id=dr.listing_id
  WHERE dr.school_id IS DISTINCT FROM l.school_id;
  SELECT count(*) INTO duplicate_approvals FROM (
    SELECT listing_id FROM public.donation_requests
    WHERE status='approved' AND listing_id IS NOT NULL
    GROUP BY listing_id HAVING count(*)>1
  ) x;
  SELECT count(*) INTO invalid_initial_state FROM public.donation_requests
   WHERE status='pending' AND
     (approved_by_admin_id IS NOT NULL OR assigned_to_requester_id IS NOT NULL);
  IF mismatches<>0 OR duplicate_approvals<>0 OR invalid_initial_state<>0 THEN
    RAISE EXCEPTION 'NO_GO_591: review existing data mismatch %, duplicated approved %, inconsistent pending %',
      mismatches,duplicate_approvals,invalid_initial_state;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public'
     AND indexname='donation_requests_one_approved_per_listing_idx') THEN
    RAISE EXCEPTION 'NO_GO_591: index exists; verify definition before changes';
  END IF;
END $gate$;

-- An index protects the race between two DIFFERENT request rows.
CREATE UNIQUE INDEX donation_requests_one_approved_per_listing_idx
 ON public.donation_requests (listing_id)
 WHERE status = 'approved' AND listing_id IS NOT NULL;

-- Preserve RLS, other policies, ordinary grants and existing API shape.
-- A valid requester may insert PENDING only for an existing, AVAILABLE
-- DONATION listing and with matching school context. NULL school is valid.
-- listings SELECT RLS already exposes available listings to public readers.
ALTER POLICY "Users can create donation requests"
 ON public.donation_requests TO authenticated
 WITH CHECK (
   (select auth.uid()) = requester_id
   AND listing_id IS NOT NULL
   AND status = 'pending'
   AND assigned_to_requester_id IS NULL
   AND approved_by_admin_id IS NULL
   AND EXISTS (
     SELECT 1 FROM public.listings l
     WHERE l.id = donation_requests.listing_id
       AND l.status = 'available'
       AND l.listing_type = 'donation'
       AND l.seller_id IS DISTINCT FROM (select auth.uid())
       AND l.school_id IS NOT DISTINCT FROM donation_requests.school_id
   )
 );

DO $postflight$
DECLARE policy_ok boolean;
BEGIN
 SELECT p.cmd='INSERT' AND p.roles::text='{authenticated}'
    AND p.with_check ILIKE '%assigned_to_requester_id IS NULL%'
    AND p.with_check ILIKE '%approved_by_admin_id IS NULL%'
    AND p.with_check ILIKE '%listing_type%'
    AND p.with_check ILIKE '%school_id%'
 INTO policy_ok FROM pg_policies p
 WHERE schemaname='public' AND tablename='donation_requests'
   AND policyname='Users can create donation requests';
 IF policy_ok IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'NO_GO_591: postflight policy missing or unexpected';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_indexes
  WHERE schemaname='public' AND tablename='donation_requests'
    AND indexname='donation_requests_one_approved_per_listing_idx'
    AND indexdef ILIKE '%UNIQUE INDEX%'
    AND indexdef ILIKE '%WHERE%'
 ) THEN
  RAISE EXCEPTION 'NO_GO_591: postflight unique index missing';
 END IF;
END $postflight$;

COMMIT;
-- ROLLBACK strategy, NOT automatically executed: restore exact policy ACL/check
-- from signed preflight SQL and DROP INDEX only after verifying its data effects.
