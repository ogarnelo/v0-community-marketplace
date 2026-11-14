-- WETUDY proof-only proposal. Apply ONLY via a reviewed migration in an isolated PostgreSQL17 sandbox.
-- RPC executed by service_role; never let anon/authenticated change the outbox.
BEGIN;
CREATE OR REPLACE FUNCTION public.marketplace_alert_pause_outbox_v1(
  p_listing_id uuid, p_lease_token uuid
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $fn$
  WITH updated AS (
    UPDATE public.marketplace_alert_outbox AS q
    SET state = 'pending',
        attempts = greatest(q.attempts - 1, 0),
        next_attempt_at = now() + interval '15 minutes',
        lease_token = NULL,
        lease_until = NULL,
        last_error_code = 'alerts_paused'
    WHERE q.listing_id = p_listing_id
      AND q.state = 'processing'
      AND q.lease_token = p_lease_token
      AND q.lease_until > now()
      AND q.expires_at > now()
    RETURNING q.listing_id
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$fn$;
REVOKE ALL ON FUNCTION public.marketplace_alert_pause_outbox_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_alert_pause_outbox_v1(uuid, uuid) TO service_role;
COMMIT;
