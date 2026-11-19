-- WETUDY 2026-11-19: explicitly authorized additive dormant buy-now RPC.
-- PostgreSQL 17 offline/synthetic verification is required before considering
-- any production DDL. This file is NOT in supabase/migrations.
-- Not integrated into /api/offers/buy-now. Public checkout stays disabled.
-- The single function statement is atomic for DB rows. It does NOT charge
-- Stripe, deliver a notification, or solve external side effects.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.p0_buy_now_prepare_atomic_candidate(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_expected_price numeric,
  p_delivery_method text,
  p_shipment_tier text,
  p_buyer_fee numeric,
  p_shipping_amount numeric,
  p_total_amount numeric
)
RETURNS TABLE (
  listing_id uuid,
  conversation_id uuid,
  offer_id uuid,
  event_id uuid,
  payment_intent_id uuid
)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $wetudy$
DECLARE
  v_listing record;
  v_conversation uuid;
  v_offer uuid;
  v_event uuid;
  v_payment uuid;
  v_existing_conversations bigint;
BEGIN
  IF p_listing_id IS NULL OR p_buyer_id IS NULL OR p_seller_id IS NULL OR
     p_buyer_id = p_seller_id OR
     p_delivery_method IS NULL OR p_shipment_tier IS NULL OR
     p_delivery_method NOT IN ('shipping', 'in_person') OR
     p_shipment_tier NOT IN ('none','small','medium','large') OR
     (p_delivery_method = 'in_person' AND (p_shipment_tier <> 'none' OR p_shipping_amount <> 0)) OR
     (p_delivery_method = 'shipping' AND (p_shipment_tier = 'none' OR p_shipping_amount <= 0)) OR
     p_expected_price IS NULL OR p_expected_price <= 0 OR
     p_buyer_fee IS NULL OR p_buyer_fee < 0 OR
     p_shipping_amount IS NULL OR p_shipping_amount < 0 OR
     p_total_amount IS NULL OR p_total_amount <= 0 OR
     p_expected_price > 1000000 OR p_total_amount > 1000000 OR
     p_expected_price <> round(p_expected_price,2) OR
     p_buyer_fee <> round(p_buyer_fee,2) OR
     p_shipping_amount <> round(p_shipping_amount,2) OR
     p_total_amount <> round(p_total_amount,2) OR
     p_total_amount <> p_expected_price + p_buyer_fee + p_shipping_amount
  THEN
    RAISE EXCEPTION 'P0_BUY_NOW_INVALID_QUOTE' USING ERRCODE='P0001';
  END IF;

  -- This row lock serializes competing buyers of the SAME listing. A second
  -- caller sees the committed reserved status and cannot create duplicates.
  SELECT l.id,l.seller_id,l.school_id,l.price,l.status,l.listing_type
    INTO v_listing FROM public.listings l
   WHERE l.id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'P0_BUY_NOW_LISTING_CHANGED' USING ERRCODE='P0001';
  END IF;
  IF v_listing.status IS DISTINCT FROM 'available' OR
     v_listing.listing_type IS DISTINCT FROM 'sale' OR
     v_listing.seller_id IS DISTINCT FROM p_seller_id OR
     v_listing.price IS DISTINCT FROM p_expected_price
  THEN
    RAISE EXCEPTION 'P0_BUY_NOW_LISTING_CHANGED' USING ERRCODE='P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.listing_offers o
    WHERE o.listing_id=p_listing_id AND o.status='accepted'
  ) OR EXISTS (
    SELECT 1 FROM public.listing_offers o
    WHERE o.listing_id=p_listing_id AND o.buyer_id=p_buyer_id AND
          o.seller_id=p_seller_id AND o.status IN ('pending','countered','accepted')
  ) THEN
    RAISE EXCEPTION 'P0_BUY_NOW_EXISTING_OFFER' USING ERRCODE='P0001';
  END IF;

  SELECT count(*) INTO v_existing_conversations
    FROM public.conversations c
   WHERE c.listing_id=p_listing_id AND c.buyer_id=p_buyer_id
     AND c.seller_id=p_seller_id;
  SELECT c.id INTO v_conversation
    FROM public.conversations c
   WHERE c.listing_id=p_listing_id AND c.buyer_id=p_buyer_id
     AND c.seller_id=p_seller_id ORDER BY c.id LIMIT 1;
  IF v_existing_conversations>1 THEN
    RAISE EXCEPTION 'P0_BUY_NOW_AMBIGUOUS_CONVERSATION' USING ERRCODE='P0001';
  END IF;
  IF v_conversation IS NULL THEN
    INSERT INTO public.conversations(listing_id,buyer_id,seller_id)
    VALUES(p_listing_id,p_buyer_id,p_seller_id)
    RETURNING id INTO v_conversation;
  END IF;

  UPDATE public.listings SET status='reserved' WHERE id=p_listing_id;

  INSERT INTO public.listing_offers(
    listing_id,buyer_id,seller_id,offered_price,current_amount,
    accepted_amount,current_actor,rounds_count,status,responded_at
  ) VALUES (
    p_listing_id,p_buyer_id,p_seller_id,p_expected_price,p_expected_price,
    p_expected_price,NULL,1,'accepted',now()
  ) RETURNING id INTO v_offer;

  INSERT INTO public.listing_offer_events(
    offer_id,conversation_id,actor_id,actor_role,event_type,
    amount,round_number,status_snapshot
  ) VALUES (
    v_offer,v_conversation,p_buyer_id,'buyer','accepted',
    p_expected_price,1,'accepted'
  ) RETURNING id INTO v_event;

  -- Matches buildOfferChatBody V2 and the existing frontend parser. The SQL
  -- current_actor column above is NULL; "closed" is a chat-turn marker only.
  INSERT INTO public.messages(conversation_id,sender_id,body)
  VALUES (
    v_conversation,p_buyer_id,
    format('💰 OFFER_EVENT|%s|%s|accepted|buyer|%s|1|accepted|closed',
      v_event,v_offer,p_expected_price)
  );

  DELETE FROM public.hidden_conversations h
   WHERE h.conversation_id=v_conversation
     AND h.user_id IN (p_buyer_id,p_seller_id);
  UPDATE public.conversations SET updated_at=now() WHERE id=v_conversation;

  -- This is a LOCAL payment-intent record, not a provider charge.
  INSERT INTO public.payment_intents(
    listing_id,conversation_id,offer_id,buyer_id,seller_id,school_id,
    amount,currency,provider,status,buyer_fee_amount,shipping_amount,
    seller_net_amount,platform_fee_amount,shipment_tier,metadata
  ) VALUES (
    p_listing_id,v_conversation,v_offer,p_buyer_id,p_seller_id,
    v_listing.school_id,p_expected_price,'EUR','stripe','requires_payment_method',
    p_buyer_fee,p_shipping_amount,p_expected_price,p_buyer_fee,p_shipment_tier,
    jsonb_build_object('source','buy_now','delivery_method',p_delivery_method,
                       'item_amount',p_expected_price,
                       'total_buyer_amount',p_total_amount)
  ) RETURNING id INTO v_payment;

  RETURN QUERY SELECT p_listing_id,v_conversation,v_offer,v_event,v_payment;
END
$wetudy$;

-- Client roles cannot call a privileged checkout preparation function.
-- service_role is the ONLY designated invoker after a future explicit review.
REVOKE ALL ON FUNCTION public.p0_buy_now_prepare_atomic_candidate(
 uuid,uuid,uuid,numeric,text,text,numeric,numeric,numeric)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p0_buy_now_prepare_atomic_candidate(
 uuid,uuid,uuid,numeric,text,text,numeric,numeric,numeric)
 TO service_role;

-- Transactional postflight: prevent any public/client execution.
DO $guard$
BEGIN
  IF to_regprocedure('public.p0_buy_now_prepare_atomic_candidate(uuid,uuid,uuid,numeric,text,text,numeric,numeric,numeric)') IS NULL OR
     has_function_privilege('anon','public.p0_buy_now_prepare_atomic_candidate(uuid,uuid,uuid,numeric,text,text,numeric,numeric,numeric)','EXECUTE') OR
     has_function_privilege('authenticated','public.p0_buy_now_prepare_atomic_candidate(uuid,uuid,uuid,numeric,text,text,numeric,numeric,numeric)','EXECUTE') OR
     NOT has_function_privilege('service_role','public.p0_buy_now_prepare_atomic_candidate(uuid,uuid,uuid,numeric,text,text,numeric,numeric,numeric)','EXECUTE') OR
     (SELECT p.prosecdef FROM pg_proc p WHERE p.oid='public.p0_buy_now_prepare_atomic_candidate(uuid,uuid,uuid,numeric,text,text,numeric,numeric,numeric)'::regprocedure)
  THEN RAISE EXCEPTION 'WETUDY_CANDIDATE_RPC_PRIVILEGE_POSTFLIGHT_FAILED'; END IF;
END
$guard$;
