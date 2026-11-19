-- WETUDY 2026-11-19: explicitly authorized additive dormant exclusive-claim RPC.
-- New authorization is REQUIRED before running any DDL in Supabase.
-- This is NOT in supabase/migrations and NOT called by production cron.
-- Each subscription/period gets at most one irreversible provider attempt.
-- An ambiguous provider result remains claimed; manual reconciliation is
-- safer than sending twice. No automatic claim expiry or blind retry.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE public.p0_school_impact_dispatch_claims_candidate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.school_impact_report_subscriptions(id),
  period_key text NOT NULL CHECK (period_key ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed','accepted','unknown','reconciled')),
  provider_message_id text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  CONSTRAINT p0_school_impact_unique_period UNIQUE(subscription_id,period_key),
  CONSTRAINT p0_school_impact_accepted_requires_provider
    CHECK (status <> 'accepted' OR provider_message_id IS NOT NULL)
);

ALTER TABLE public.p0_school_impact_dispatch_claims_candidate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.p0_school_impact_dispatch_claims_candidate
  FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.p0_school_impact_dispatch_claims_candidate
  TO service_role;

CREATE OR REPLACE FUNCTION public.p0_school_impact_claim_candidate(
  p_subscription_id uuid,
  p_period_key text,
  p_user_id uuid,
  p_school_id uuid,
  p_day int,
  p_email text,
  p_expected_last_sent text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog, public
AS $wetudy$
DECLARE
  v_subscription record;
  v_claim_id uuid;
BEGIN
  IF p_subscription_id IS NULL OR p_user_id IS NULL OR p_school_id IS NULL OR
     p_day IS NULL OR p_day < 1 OR p_day > 28 OR
     p_email IS NULL OR char_length(trim(p_email)) < 3 OR
     p_period_key IS NULL OR p_period_key !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'
  THEN
    RAISE EXCEPTION 'P0_SCHOOL_IMPACT_CLAIM_INVALID' USING ERRCODE='P0001';
  END IF;
  SELECT s.id,s.user_id,s.school_id,s.email,s.enabled,s.day_of_month,s.last_sent_month
    INTO v_subscription
    FROM public.school_impact_report_subscriptions s
   WHERE s.id=p_subscription_id FOR UPDATE;
  IF NOT FOUND OR v_subscription.enabled IS DISTINCT FROM TRUE OR
     v_subscription.user_id IS DISTINCT FROM p_user_id OR
     v_subscription.school_id IS DISTINCT FROM p_school_id OR
     lower(trim(v_subscription.email)) IS DISTINCT FROM lower(trim(p_email)) OR
     v_subscription.day_of_month IS DISTINCT FROM p_day OR
     v_subscription.last_sent_month IS DISTINCT FROM p_expected_last_sent OR
     v_subscription.last_sent_month = p_period_key
  THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.schools s WHERE s.id=p_school_id AND s.is_active IS TRUE
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_roles r
     WHERE r.user_id=p_user_id AND r.school_id=p_school_id AND r.role='school_admin'
  ) THEN
    RETURN NULL;
  END IF;

  -- Unique subscription+period and a row lock prevent two concurrent workers
  -- acquiring the same claim. No lease expiry: uncertainty means reconcile.
  INSERT INTO public.p0_school_impact_dispatch_claims_candidate(
    subscription_id,period_key,school_id,user_id,status
  ) VALUES(p_subscription_id,p_period_key,p_school_id,p_user_id,'claimed')
  ON CONFLICT(subscription_id,period_key) DO NOTHING
  RETURNING id INTO v_claim_id;
  RETURN v_claim_id;
END
$wetudy$;

CREATE OR REPLACE FUNCTION public.p0_school_impact_ack_candidate(
  p_claim_id uuid, p_provider_message_id text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog, public
AS $wetudy$
DECLARE
  v_claim_id uuid;
BEGIN
  IF p_claim_id IS NULL OR p_provider_message_id IS NULL OR
     char_length(trim(p_provider_message_id)) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'P0_SCHOOL_IMPACT_ACK_INVALID' USING ERRCODE='P0001';
  END IF;

  UPDATE public.p0_school_impact_dispatch_claims_candidate
     SET status='accepted',provider_message_id=trim(p_provider_message_id),
         acknowledged_at=now()
   WHERE id=p_claim_id AND status='claimed'
   RETURNING id INTO v_claim_id;
  RETURN v_claim_id IS NOT NULL;
END
$wetudy$;

REVOKE ALL ON FUNCTION public.p0_school_impact_claim_candidate(
 uuid,text,uuid,uuid,int,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.p0_school_impact_ack_candidate(
 uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p0_school_impact_claim_candidate(
 uuid,text,uuid,uuid,int,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.p0_school_impact_ack_candidate(
 uuid,text) TO service_role;

-- Guard runs in the same migration transaction as the created objects.
DO $guard$
DECLARE v_rel oid := to_regclass('public.p0_school_impact_dispatch_claims_candidate');
BEGIN
  IF v_rel IS NULL OR
     NOT (SELECT relrowsecurity FROM pg_class WHERE oid=v_rel) OR
     has_table_privilege('anon',v_rel,'SELECT') OR
     has_table_privilege('authenticated',v_rel,'SELECT') OR
     has_table_privilege('anon',v_rel,'INSERT') OR
     has_table_privilege('authenticated',v_rel,'INSERT') OR
     NOT has_table_privilege('service_role',v_rel,'SELECT') OR
     NOT has_table_privilege('service_role',v_rel,'INSERT') OR
     to_regprocedure('public.p0_school_impact_claim_candidate(uuid,text,uuid,uuid,int,text,text)') IS NULL OR
     to_regprocedure('public.p0_school_impact_ack_candidate(uuid,text)') IS NULL OR
     has_function_privilege('anon','public.p0_school_impact_claim_candidate(uuid,text,uuid,uuid,int,text,text)','EXECUTE') OR
     has_function_privilege('authenticated','public.p0_school_impact_claim_candidate(uuid,text,uuid,uuid,int,text,text)','EXECUTE') OR
     has_function_privilege('anon','public.p0_school_impact_ack_candidate(uuid,text)','EXECUTE') OR
     has_function_privilege('authenticated','public.p0_school_impact_ack_candidate(uuid,text)','EXECUTE') OR
     NOT has_function_privilege('service_role','public.p0_school_impact_claim_candidate(uuid,text,uuid,uuid,int,text,text)','EXECUTE') OR
     NOT has_function_privilege('service_role','public.p0_school_impact_ack_candidate(uuid,text)','EXECUTE')
  THEN RAISE EXCEPTION 'WETUDY_REPORT_CLAIM_PRIVILEGE_POSTFLIGHT_FAILED'; END IF;
END
$guard$;
