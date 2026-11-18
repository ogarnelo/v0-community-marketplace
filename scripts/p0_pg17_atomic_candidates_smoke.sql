-- PostgreSQL 17 synthetic checks for TWO REVIEW-ONLY candidates.
-- Must run only after p0_pg17_atomic_candidates_fixture.sql and both
-- scripts/p0_*_candidate_review_only.sql in an isolated, disposable DB.

DO $test$
BEGIN
  IF has_function_privilege('anon',
    'public.p0_buy_now_prepare_atomic_candidate(uuid,uuid,uuid,numeric,text,text,numeric,numeric,numeric)','EXECUTE') OR
     has_function_privilege('authenticated',
    'public.p0_buy_now_prepare_atomic_candidate(uuid,uuid,uuid,numeric,text,text,numeric,numeric,numeric)','EXECUTE') OR
     has_function_privilege('authenticated',
    'public.p0_school_impact_claim_candidate(uuid,text,uuid,uuid,int,text,text)','EXECUTE') OR
     NOT has_function_privilege('service_role',
    'public.p0_school_impact_claim_candidate(uuid,text,uuid,uuid,int,text,text)','EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: candidate function privilege boundary';
  END IF;
END $test$;

-- Use the same service_role that would be the ONLY designated future caller.
SET ROLE service_role;
DO $test$
DECLARE
  v_result record;
  v_claim uuid;
  v_again uuid;
  v_ack boolean;
BEGIN
  SELECT * INTO v_result FROM public.p0_buy_now_prepare_atomic_candidate(
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    15.00,'in_person','none',0,0,15.00);
  IF v_result.listing_id IS NULL OR v_result.conversation_id IS NULL OR
     v_result.offer_id IS NULL OR v_result.event_id IS NULL OR
     v_result.payment_intent_id IS NULL
  THEN
    RAISE EXCEPTION 'FAIL: full checkout preparation transaction missing an id';
  END IF;
  IF (SELECT status FROM public.listings
      WHERE id='44444444-4444-4444-8444-444444444444') <> 'reserved' OR
     (SELECT count(*) FROM public.listing_offers WHERE
      listing_id='44444444-4444-4444-8444-444444444444'
      AND status='accepted' AND current_actor IS NULL) <> 1 OR
     (SELECT count(*) FROM public.payment_intents WHERE
      offer_id=v_result.offer_id AND status='requires_payment_method')<>1 OR
     (SELECT count(*) FROM public.messages WHERE
      conversation_id=v_result.conversation_id AND body LIKE '💰 OFFER_EVENT|%')<>1
  THEN
    RAISE EXCEPTION 'FAIL: checkout rows incomplete or violate actor state';
  END IF;

  -- Unique period claim is permanent until audited; even same worker
  -- cannot reacquire an ambiguous delivery for automatic retransmission.
  v_claim:=public.p0_school_impact_claim_candidate(
    '66666666-6666-4666-8666-666666666666','2026-10',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',18,
    'synthetic@example.invalid',NULL);
  v_again:=public.p0_school_impact_claim_candidate(
    '66666666-6666-4666-8666-666666666666','2026-10',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',18,
    'synthetic@example.invalid',NULL);
  IF v_claim IS NULL OR v_again IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: duplicate cron month claim';
  END IF;
  v_ack:=public.p0_school_impact_ack_candidate(v_claim,'provider-synthetic-1');
  IF v_ack IS NOT TRUE OR public.p0_school_impact_ack_candidate(
    v_claim,'provider-synthetic-2') IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: acknowledgement idempotence';
  END IF;
  IF (SELECT count(*) FROM public.p0_school_impact_dispatch_claims_candidate
       WHERE subscription_id='66666666-6666-4666-8666-666666666666'
       AND period_key='2026-10' AND status='accepted')<>1 THEN
    RAISE EXCEPTION 'FAIL: provider acceptance not durable';
  END IF;
END $test$;
RESET ROLE;

-- A competing buyer loses; the second request cannot create further records.
DO $test$
DECLARE
  blocked boolean:=false;
BEGIN
  BEGIN
    PERFORM public.p0_buy_now_prepare_atomic_candidate(
      '44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      15.00,'in_person','none',0,0,15.00);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN blocked:=true;
  END;
  IF NOT blocked OR
     (SELECT count(*) FROM public.listing_offers WHERE
      listing_id='44444444-4444-4444-8444-444444444444')<>1
  THEN
    RAISE EXCEPTION 'FAIL: repeated buyer was not denied';
  END IF;
END $test$;

-- Simulate an unexpected INSERT failure at the LAST step of checkout.
-- A single function call must ROLLBACK every preceding DB write.
CREATE FUNCTION public.p0_synthetic_block_payment() RETURNS trigger
LANGUAGE plpgsql AS $b$ BEGIN RAISE EXCEPTION 'synthetic payment failure'; END $b$;
CREATE TRIGGER p0_block_payment BEFORE INSERT ON public.payment_intents
FOR EACH ROW EXECUTE FUNCTION public.p0_synthetic_block_payment();
DO $test$
DECLARE
  failed boolean:=false;
BEGIN
  BEGIN
    PERFORM public.p0_buy_now_prepare_atomic_candidate(
      '55555555-5555-4555-8555-555555555555',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      20.00,'shipping','small',1.00,2.99,23.99);
  EXCEPTION WHEN OTHERS THEN failed:=true;
  END;
  IF NOT failed OR
     (SELECT status FROM public.listings WHERE
      id='55555555-5555-4555-8555-555555555555')<>'available' OR
     (SELECT count(*) FROM public.listing_offers WHERE
      listing_id='55555555-5555-4555-8555-555555555555')<>0 OR
     (SELECT count(*) FROM public.conversations WHERE
      listing_id='55555555-5555-4555-8555-555555555555')<>0
  THEN
    RAISE EXCEPTION 'FAIL: checkout preparation did not rollback after last insert';
  END IF;
END $test$;
DROP TRIGGER p0_block_payment ON public.payment_intents;
DROP FUNCTION public.p0_synthetic_block_payment();

-- SQL-only controls: a disabled subscription cannot get a fresh claim.
UPDATE public.school_impact_report_subscriptions SET enabled=false
 WHERE id='66666666-6666-4666-8666-666666666666';
DO $test$
BEGIN
  IF public.p0_school_impact_claim_candidate(
    '66666666-6666-4666-8666-666666666666','2026-11',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',18,
    'synthetic@example.invalid',NULL) IS NOT NULL
  THEN
    RAISE EXCEPTION 'FAIL: disabled subscription acquired claim';
  END IF;
END $test$;

SELECT 'PG17_SYNTHETIC_ATOMIC_CANDIDATES_OK' AS result;
