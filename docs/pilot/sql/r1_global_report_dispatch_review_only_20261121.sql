-- REVIEW ONLY. Never autodeploy. Keep WETUDY_SUPER_ADMIN_REPORT_EMAIL_ENABLED OFF.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.r1_global_report_dispatch_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 -- Retain opaque dispatch identity without blocking subscription/account deletion.
 -- The claim function verifies and locks the live subscription before INSERT.
 subscription_id uuid NOT NULL,
 scheduled_for timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'claimed' CHECK(status IN ('claimed','accepted','unknown')),
 provider_message_id text,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 acknowledged_at timestamptz,
 UNIQUE(subscription_id,scheduled_for),
 CHECK(status <> 'accepted' OR provider_message_id IS NOT NULL)
);
ALTER TABLE public.r1_global_report_dispatch_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.r1_global_report_dispatch_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.r1_global_report_dispatch_claims TO service_role;
CREATE FUNCTION public.r1_global_report_claim(
 p_subscription_id uuid,p_user_id uuid,p_scheduled_for timestamptz,
 p_email text,p_frequency integer,p_range text,p_format text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $f$
DECLARE v_sub public.super_admin_report_subscriptions%ROWTYPE; v_id uuid;
BEGIN
 SELECT * INTO v_sub FROM public.super_admin_report_subscriptions
 WHERE id=p_subscription_id FOR UPDATE;
 IF NOT FOUND OR v_sub.enabled IS DISTINCT FROM true
 OR v_sub.user_id IS DISTINCT FROM p_user_id
 OR v_sub.next_send_at IS DISTINCT FROM p_scheduled_for
 OR p_scheduled_for IS NULL OR p_scheduled_for>now()
 OR v_sub.email IS DISTINCT FROM p_email
 OR v_sub.frequency_days IS DISTINCT FROM p_frequency
 OR v_sub.report_range IS DISTINCT FROM p_range
 OR v_sub.report_format IS DISTINCT FROM p_format
 OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user_id AND role='super_admin')
 THEN RETURN NULL; END IF;
 -- No automatic lease expiry: after a crash the claim remains blocked.
 -- An unknown/claimed dispatch must be reconciled, never automatically retried.
 INSERT INTO public.r1_global_report_dispatch_claims(subscription_id,scheduled_for)
 VALUES(p_subscription_id,p_scheduled_for)
 ON CONFLICT(subscription_id,scheduled_for) DO NOTHING RETURNING id INTO v_id;
 RETURN v_id;
END $f$;
CREATE FUNCTION public.r1_global_report_ack(p_claim_id uuid,p_provider_id text)
 RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $f$
DECLARE v_id uuid;
BEGIN
 IF p_provider_id IS NULL OR length(trim(p_provider_id)) NOT BETWEEN 1 AND 200
 THEN RAISE EXCEPTION 'INVALID_PROVIDER_ID'; END IF;
 UPDATE public.r1_global_report_dispatch_claims SET status='accepted',
 provider_message_id=trim(p_provider_id),acknowledged_at=now()
 WHERE id=p_claim_id AND status='claimed' RETURNING id INTO v_id;
 RETURN v_id IS NOT NULL;
END $f$;
REVOKE ALL ON FUNCTION public.r1_global_report_claim(uuid,uuid,timestamptz,text,integer,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.r1_global_report_ack(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.r1_global_report_claim(uuid,uuid,timestamptz,text,integer,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.r1_global_report_ack(uuid,text) TO service_role;
COMMIT;
-- Auth confirmed email must be rechecked by the server, before and after claim.
-- ACK is not subscription settlement. A failed settlement must be reconciled
-- without a second provider request. No automatic reactivation or claim deletion.
