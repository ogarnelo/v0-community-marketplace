-- WETUDY 2026-11-19 | REVIEW ONLY / NEVER AUTODEPLOY
-- A paused signed worker must preserve its earlier delivery failures.
-- Independent SQL authorization required before any production DDL.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE FUNCTION public.marketplace_alert_pause_outbox_v1(
  p_listing_id uuid, p_lease_token uuid
) RETURNS boolean LANGUAGE sql SECURITY INVOKER
SET search_path TO ''
AS $wetudy$
  WITH updated AS (
    UPDATE public.marketplace_alert_outbox AS q
       SET state='pending',
           attempts=greatest(q.attempts - 1, 0),
           next_attempt_at=now()+interval '15 minutes',
           lease_token=NULL,
           lease_until=NULL,
           last_error_code='alerts_paused'
     WHERE q.listing_id=p_listing_id
       AND q.state='processing'
       AND q.lease_token=p_lease_token
       AND q.lease_until > now()
       AND q.expires_at > now()
    RETURNING q.listing_id
  )
  SELECT EXISTS(SELECT 1 FROM updated);
$wetudy$;

REVOKE ALL ON FUNCTION public.marketplace_alert_pause_outbox_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_alert_pause_outbox_v1(uuid,uuid)
  TO service_role;

DO $guard$
BEGIN
 IF NOT has_function_privilege('service_role',
     'public.marketplace_alert_pause_outbox_v1(uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon',
     'public.marketplace_alert_pause_outbox_v1(uuid,uuid)','EXECUTE')
    OR has_function_privilege('authenticated',
     'public.marketplace_alert_pause_outbox_v1(uuid,uuid)','EXECUTE')
    OR (SELECT prosecdef FROM pg_proc
      WHERE oid='public.marketplace_alert_pause_outbox_v1(uuid,uuid)'::regprocedure)
 THEN RAISE EXCEPTION 'WETUDY_ALERT_PAUSE_ACL_FAILED'; END IF;
END
$guard$;
COMMIT;
