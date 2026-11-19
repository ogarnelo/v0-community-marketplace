-- REVIEW ONLY / NEVER AUTODEPLOY. Requires explicit SQL authorization and PG17 preflight.
-- Shared report delivery exclusion between manual and scheduled paths.
-- Scope: one irreversible provider attempt per school, recipient and calendar month.
-- Keep BOTH WETUDY_SCHOOL_IMPACT_*_EMAIL_ENABLED flags OFF until deployed and tested.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.p0_school_impact_shared_dispatch_claims_candidate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  user_id uuid NOT NULL,
  period_key text NOT NULL CHECK (period_key ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  source text NOT NULL CHECK (source IN ('manual','cron')),
  subscription_id uuid REFERENCES public.school_impact_report_subscriptions(id),
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed','accepted','unknown','reconciled')),
  provider_message_id text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  CONSTRAINT p0_school_impact_shared_unique_recipient_month
    UNIQUE (school_id,user_id,period_key),
  CONSTRAINT p0_school_impact_shared_provider_required
    CHECK (status <> 'accepted' OR provider_message_id IS NOT NULL),
  CONSTRAINT p0_school_impact_shared_cron_subscription
    CHECK (source <> 'cron' OR subscription_id IS NOT NULL)
);
ALTER TABLE public.p0_school_impact_shared_dispatch_claims_candidate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.p0_school_impact_shared_dispatch_claims_candidate
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.p0_school_impact_shared_dispatch_claims_candidate
  TO service_role;

CREATE FUNCTION public.p0_school_impact_shared_claim_candidate(
  p_school_id uuid, p_user_id uuid, p_period_key text, p_email text,
  p_source text, p_subscription_id uuid DEFAULT NULL,
  p_day int DEFAULT NULL, p_expected_last_sent text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $wetudy$
DECLARE
  v_sub record;
  v_id uuid;
BEGIN
  IF p_school_id IS NULL OR p_user_id IS NULL OR
     p_period_key IS NULL OR p_period_key !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' OR
     p_email IS NULL OR length(trim(p_email)) < 3 OR
     p_source NOT IN ('manual','cron') OR p_source IS NULL
  THEN
    RAISE EXCEPTION 'SCHOOL_IMPACT_SHARED_CLAIM_INVALID' USING ERRCODE='P0001';
  END IF;

  -- Read current subscriptions in a row lock; manual must work without one.
  -- A concurrent configuration update cannot race the claim decision.
  SELECT s.id,s.enabled,s.day_of_month,s.email,s.last_sent_month
    INTO v_sub
    FROM public.school_impact_report_subscriptions s
   WHERE s.school_id=p_school_id AND s.user_id=p_user_id
   FOR UPDATE;

  IF p_source='cron' THEN
    IF p_subscription_id IS NULL OR p_day IS NULL OR p_day NOT BETWEEN 1 AND 28 OR
       NOT FOUND OR v_sub.id IS DISTINCT FROM p_subscription_id OR
       v_sub.enabled IS DISTINCT FROM true OR
       v_sub.day_of_month IS DISTINCT FROM p_day OR
       lower(trim(v_sub.email)) IS DISTINCT FROM lower(trim(p_email)) OR
       v_sub.last_sent_month IS DISTINCT FROM p_expected_last_sent
    THEN RETURN NULL; END IF;
  ELSE
    IF p_subscription_id IS NOT NULL OR p_day IS NOT NULL OR
       p_expected_last_sent IS NOT NULL THEN RETURN NULL; END IF;
  END IF;

  -- Manual and cron both honor an already delivered subscription month.
  IF v_sub.id IS NOT NULL AND v_sub.last_sent_month = p_period_key THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.school_impact_report_deliveries d
     WHERE d.school_id=p_school_id AND d.user_id=p_user_id
       AND d.period_key=p_period_key
  ) THEN RETURN NULL; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.schools s WHERE s.id=p_school_id AND s.is_active=true
  ) OR (
    SELECT count(*) FROM public.user_roles r
     WHERE r.user_id=p_user_id AND r.role='school_admin'
  ) <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.user_roles r
     WHERE r.user_id=p_user_id AND r.role='school_admin'
       AND r.school_id=p_school_id
  ) THEN
    RETURN NULL;
  END IF;

  -- A unique constraint, not a process-local lock, serializes ALL senders.
  -- Claims never expire or auto-retry after an ambiguous provider result.
  INSERT INTO public.p0_school_impact_shared_dispatch_claims_candidate (
    school_id,user_id,period_key,source,subscription_id
  ) VALUES (p_school_id,p_user_id,p_period_key,p_source,p_subscription_id)
  ON CONFLICT (school_id,user_id,period_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END
$wetudy$;

CREATE FUNCTION public.p0_school_impact_shared_ack_candidate(
  p_claim_id uuid, p_provider_message_id text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $wetudy$
DECLARE v_id uuid;
BEGIN
  IF p_claim_id IS NULL OR p_provider_message_id IS NULL OR
     length(trim(p_provider_message_id)) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'SCHOOL_IMPACT_SHARED_ACK_INVALID' USING ERRCODE='P0001';
  END IF;
  UPDATE public.p0_school_impact_shared_dispatch_claims_candidate
     SET status='accepted', provider_message_id=trim(p_provider_message_id),
         acknowledged_at=now()
   WHERE id=p_claim_id AND status='claimed'
   RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END
$wetudy$;

REVOKE ALL ON FUNCTION public.p0_school_impact_shared_claim_candidate(
 uuid,uuid,text,text,text,uuid,int,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.p0_school_impact_shared_ack_candidate(
 uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p0_school_impact_shared_claim_candidate(
 uuid,uuid,text,text,text,uuid,int,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.p0_school_impact_shared_ack_candidate(
 uuid,text) TO service_role;

DO $guard$
BEGIN
  IF (SELECT relrowsecurity FROM pg_class WHERE oid=
        'public.p0_school_impact_shared_dispatch_claims_candidate'::regclass) IS DISTINCT FROM true OR
     has_table_privilege('anon','public.p0_school_impact_shared_dispatch_claims_candidate','SELECT') OR
     has_table_privilege('authenticated','public.p0_school_impact_shared_dispatch_claims_candidate','INSERT') OR
     has_function_privilege('anon',
       'public.p0_school_impact_shared_claim_candidate(uuid,uuid,text,text,text,uuid,int,text)',
       'EXECUTE') OR
     has_function_privilege('authenticated',
       'public.p0_school_impact_shared_ack_candidate(uuid,text)','EXECUTE') OR
     NOT has_function_privilege('service_role',
       'public.p0_school_impact_shared_claim_candidate(uuid,uuid,text,text,text,uuid,int,text)',
       'EXECUTE')
  THEN RAISE EXCEPTION 'SCHOOL_IMPACT_SHARED_PRIVILEGES_FAILED'; END IF;
END
$guard$;
COMMIT;

-- ROLLOUT: deploy RPC with flags OFF; integrate BOTH routes; run synthetic
-- concurrency + PG17 isolation; reconcile pre-existing delivery audit and old
-- subscription claims before activating. Never clear an uncertain claim to retry.
