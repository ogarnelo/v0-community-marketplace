-- Disposable isolated PostgreSQL 17 fixture ONLY; NEVER production.
-- Runs after all existing outbox fixtures and the full-schema smoke.
-- Do not put real users, emails, postal codes, or service keys in this test.
\i scripts/pilot-alerts-pause-v1-proposal.sql

DO $$
BEGIN
  IF NOT has_function_privilege('service_role','public.marketplace_alert_pause_outbox_v1(uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.marketplace_alert_pause_outbox_v1(uuid,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.marketplace_alert_pause_outbox_v1(uuid,uuid)','EXECUTE')
     OR EXISTS (
       SELECT 1 FROM pg_proc p
       CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
       WHERE p.oid='public.marketplace_alert_pause_outbox_v1(uuid,uuid)'::regprocedure
         AND acl.grantee=0 AND acl.privilege_type='EXECUTE'
     )
  THEN RAISE EXCEPTION 'Pause RPC privilege gate failed'; END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.marketplace_alert_pause_outbox_v1(uuid,uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'Pause RPC must not be SECURITY DEFINER';
  END IF;
END $$;

-- The prior fixtures use only synthetically generated listing rows.
UPDATE public.marketplace_alert_outbox SET
  state='completed', completed_at=now(), lease_token=NULL, lease_until=NULL
WHERE state <> 'completed';
INSERT INTO public.listings(id,seller_id,status,is_demo)
VALUES ('94000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001','available',false);
UPDATE public.marketplace_alert_outbox
SET state='pending', attempts=2, next_attempt_at=now()-interval '1 minute',
    expires_at=now()+interval '2 hours', lease_token=NULL, lease_until=NULL
WHERE listing_id='94000000-0000-4000-8000-000000000001';

DO $$
DECLARE
  id uuid := '94000000-0000-4000-8000-000000000001';
  claimed_id uuid;
  token_one uuid;
  token_two uuid;
  tries integer;
  qstate text;
  until_next timestamptz;
BEGIN
  SELECT x.listing_id,x.lease_token,x.attempts
  INTO claimed_id,token_one,tries
  FROM public.marketplace_alert_claim_outbox_v1(1,240) x;
  IF claimed_id IS DISTINCT FROM id OR tries <> 3 OR token_one IS NULL THEN
    RAISE EXCEPTION 'Pause fixture failed to claim with two prior failures';
  END IF;
  IF public.marketplace_alert_pause_outbox_v1(id,gen_random_uuid()) THEN
    RAISE EXCEPTION 'Forged token paused worker';
  END IF;
  IF NOT public.marketplace_alert_pause_outbox_v1(id,token_one) THEN
    RAISE EXCEPTION 'Valid lease cannot pause safely';
  END IF;
  SELECT state,attempts,lease_token,next_attempt_at
    INTO qstate,tries,token_two,until_next
    FROM public.marketplace_alert_outbox WHERE listing_id=id;
  IF qstate<>'pending' OR tries<>2 OR token_two IS NOT NULL OR
     until_next < now()+interval '14 minutes' OR
     until_next > now()+interval '16 minutes' THEN
    RAISE EXCEPTION 'Pause erased previous failures or did not back off';
  END IF;
  IF public.marketplace_alert_pause_outbox_v1(id,token_one) THEN
    RAISE EXCEPTION 'Reused pause lease succeeded';
  END IF;
  IF (SELECT count(*) FROM public.marketplace_alert_claim_outbox_v1(1,240)) <> 0 THEN
    RAISE EXCEPTION 'Paused job was reclaimed during its backoff';
  END IF;

  UPDATE public.marketplace_alert_outbox
     SET next_attempt_at=now()-interval '1 minute' WHERE listing_id=id;
  SELECT x.lease_token,x.attempts INTO token_two,tries
    FROM public.marketplace_alert_claim_outbox_v1(1,240) x;
  IF token_two IS NULL OR token_two=token_one OR tries<>3 THEN
    RAISE EXCEPTION 'New claim did not preserve prior failure count';
  END IF;
  UPDATE public.marketplace_alert_outbox SET lease_until=now()-interval '1 second'
    WHERE listing_id=id;
  IF public.marketplace_alert_pause_outbox_v1(id,token_two) THEN
    RAISE EXCEPTION 'Expired lease paused job';
  END IF;

  UPDATE public.marketplace_alert_outbox
    SET lease_until=now()+interval '1 hour', expires_at=now()-interval '1 second'
    WHERE listing_id=id;
  IF public.marketplace_alert_pause_outbox_v1(id,token_two) THEN
    RAISE EXCEPTION 'Expired 48h deadline paused job';
  END IF;
  IF (SELECT attempts FROM public.marketplace_alert_outbox WHERE listing_id=id) <> 3 THEN
    RAISE EXCEPTION 'Rejected late pause unexpectedly rewrote attempts';
  END IF;
END $$;
SELECT 'PASS: pause service-only, fencing, 15min backoff, attempt preservation, expiry' AS result;
