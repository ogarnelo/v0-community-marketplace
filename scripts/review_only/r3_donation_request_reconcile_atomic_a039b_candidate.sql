-- WETUDY R3/A-039b — REVIEW ONLY, NOT AN AUTOMATIC MIGRATION.
-- For Education Marketplace jpsljmakoscqevssimtk only. New explicit owner
-- authorization is REQUIRED for SQL, postflight, rollout and rollback.
-- Adds two UNIQUE fences and a service_role-only SECURITY INVOKER RPC.
-- Never modifies existing table grants, RLS, policies or business flags.
-- The adapter is OFF unless the distinct deployment flag is authorized.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';
DO $preflight$
BEGIN
 IF to_regclass('public.donation_requests') IS NULL
 OR to_regclass('public.donation_request_events') IS NULL
 OR to_regclass('public.messages') IS NULL
 OR to_regclass('public.conversations') IS NULL
 OR to_regclass('public.hidden_conversations') IS NULL
 OR to_regclass('public.notifications') IS NULL
 OR to_regclass('public.listings') IS NULL
 OR to_regprocedure('public.r3_reconcile_donation_request_atomic(uuid,uuid)') IS NOT NULL
 OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.donation_requests'::regclass AND relrowsecurity)
 OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.donation_request_events'::regclass AND relrowsecurity)
 OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.messages'::regclass AND relrowsecurity)
 OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.conversations'::regclass AND relrowsecurity)
 OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.notifications'::regclass AND relrowsecurity)
 OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.listings'::regclass AND relrowsecurity)
 OR NOT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.conversations_listing_buyer_seller_idx') AND indisunique AND indisvalid AND indisready)
 OR NOT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.notifications_event_key_uidx') AND indisunique AND indisvalid AND indisready)
 OR NOT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.donation_requests_one_pending_per_requester_listing_idx') AND indisunique AND indisvalid AND indisready)
 OR to_regclass('public.donation_request_events_request_created_once_idx') IS NOT NULL
 OR to_regclass('public.messages_donation_event_once_idx') IS NOT NULL
 THEN RAISE EXCEPTION 'NO_GO_A039B_SCHEMA_OR_EXISTING_GUARDS_DRIFTED'; END IF;
 IF EXISTS (SELECT 1 FROM public.donation_request_events
      WHERE event_type='request_created' GROUP BY request_id HAVING count(*)>1)
 OR EXISTS (SELECT 1 FROM public.messages
      WHERE body LIKE '🎁 DONATION_EVENT|%'
      GROUP BY split_part(body,'|',2) HAVING count(*)>1)
 THEN RAISE EXCEPTION 'NO_GO_A039B_PREEXISTING_DUPLICATE_EVENT_OR_MESSAGE'; END IF;
 IF EXISTS (SELECT 1 FROM public.messages
   WHERE body LIKE '🎁 DONATION_EVENT|%'
     AND (split_part(body,'|',2)='' OR split_part(body,'|',3)=''))
 THEN RAISE EXCEPTION 'NO_GO_A039B_MALFORMED_DONATION_MESSAGE'; END IF;
END $preflight$;

CREATE UNIQUE INDEX donation_request_events_request_created_once_idx
 ON public.donation_request_events(request_id)
 WHERE event_type='request_created';
CREATE UNIQUE INDEX messages_donation_event_once_idx
 ON public.messages ((split_part(body,'|',2)))
 WHERE body LIKE '🎁 DONATION_EVENT|%';

CREATE FUNCTION public.r3_reconcile_donation_request_atomic(
 p_request_id uuid, p_actor_id uuid
) RETURNS TABLE(request_id uuid, conversation_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $a039b$
DECLARE
 v_req public.donation_requests%ROWTYPE;
 v_listing public.listings%ROWTYPE;
 v_evt public.donation_request_events%ROWTYPE;
 v_notice public.notifications%ROWTYPE;
 v_chat uuid;
 v_body text;
 v_key text;
 v_event_count bigint;
 v_message_count bigint;
 v_message_matches bigint;
 v_notices_count bigint;
BEGIN
 IF p_request_id IS NULL OR p_actor_id IS NULL THEN
   RAISE EXCEPTION 'A039B_INVALID_ARGUMENT' USING ERRCODE='22023';
 END IF;
 -- Discovery read is not an authority: lock listing first, then request.
 SELECT * INTO v_req FROM public.donation_requests d WHERE d.id=p_request_id;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'A039B_REQUEST_NOT_FOUND' USING ERRCODE='P0002';
 END IF;
 SELECT * INTO v_listing FROM public.listings l
 WHERE l.id=v_req.listing_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'A039B_LISTING_NOT_FOUND' USING ERRCODE='P0002';
 END IF;
 SELECT * INTO v_req FROM public.donation_requests d
 WHERE d.id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.status IS DISTINCT FROM 'pending'
 OR v_req.requester_id IS DISTINCT FROM p_actor_id
 OR v_req.listing_id IS DISTINCT FROM v_listing.id
 OR v_req.school_id IS DISTINCT FROM v_listing.school_id
 OR v_listing.status IS DISTINCT FROM 'available'
 OR coalesce(nullif(v_listing.listing_type,''),nullif(v_listing.type,'')) IS DISTINCT FROM 'donation'
 OR v_listing.seller_id IS NULL OR v_listing.seller_id=p_actor_id THEN
   RAISE EXCEPTION 'A039B_REQUEST_CONTEXT_CONFLICT' USING ERRCODE='P0001';
 END IF;

 INSERT INTO public.conversations(listing_id,buyer_id,seller_id)
 VALUES(v_listing.id,p_actor_id,v_listing.seller_id)
 ON CONFLICT(listing_id,buyer_id,seller_id) DO NOTHING;
 SELECT c.id INTO v_chat FROM public.conversations c
 WHERE c.listing_id=v_listing.id AND c.buyer_id=p_actor_id
 AND c.seller_id=v_listing.seller_id FOR UPDATE;
 IF NOT FOUND OR v_chat IS NULL THEN
   RAISE EXCEPTION 'A039B_CONVERSATION_NOT_VERIFIED';
 END IF;

 SELECT count(*) INTO v_event_count FROM public.donation_request_events e
 WHERE e.request_id=v_req.id AND e.event_type='request_created';
 IF v_event_count>1 THEN RAISE EXCEPTION 'A039B_DUPLICATE_EVENT'; END IF;
 IF v_event_count=0 THEN
   INSERT INTO public.donation_request_events
    (request_id,conversation_id,actor_id,event_type,note,status_snapshot)
   VALUES(v_req.id,v_chat,p_actor_id,'request_created',v_req.note,'pending')
   RETURNING * INTO v_evt;
 ELSE
   SELECT * INTO v_evt FROM public.donation_request_events e
   WHERE e.request_id=v_req.id AND e.event_type='request_created' FOR UPDATE;
   IF NOT FOUND OR v_evt.conversation_id IS DISTINCT FROM v_chat
   OR v_evt.actor_id IS DISTINCT FROM p_actor_id
   OR v_evt.status_snapshot IS DISTINCT FROM 'pending'
   OR v_evt.note IS DISTINCT FROM v_req.note THEN
     RAISE EXCEPTION 'A039B_EXISTING_EVENT_MISMATCH';
   END IF;
 END IF;

 v_body:='🎁 DONATION_EVENT|'||v_evt.id::text||'|'||v_req.id::text||
   '|request_created|pending|'||btrim(replace(coalesce(v_req.note,''),'|','/'));
 SELECT count(*), count(*) FILTER(WHERE m.conversation_id=v_chat
 AND m.sender_id=p_actor_id AND m.body=v_body)
 INTO v_message_count,v_message_matches FROM public.messages m
 WHERE m.body LIKE '🎁 DONATION_EVENT|'||v_evt.id::text||'|%';
 IF v_message_count>1 OR (v_message_count=1 AND v_message_matches<>1) THEN
   RAISE EXCEPTION 'A039B_EXISTING_MESSAGE_MISMATCH';
 END IF;
 IF v_message_count=0 THEN
   INSERT INTO public.messages(conversation_id,sender_id,body)
   VALUES(v_chat,p_actor_id,v_body);
 END IF;

 v_key:='donation-request:'||v_req.id::text||':created';
 SELECT count(*) INTO v_notices_count FROM public.notifications n
 WHERE n.kind='donation_requested'
 AND n.metadata->>'donation_request_id'=v_req.id::text;
 IF v_notices_count>1 THEN RAISE EXCEPTION 'A039B_DUPLICATE_NOTIFICATION'; END IF;
 IF v_notices_count=1 AND NOT EXISTS(
    SELECT 1 FROM public.notifications n WHERE n.event_key=v_key) THEN
   RAISE EXCEPTION 'A039B_LEGACY_NOTIFICATION_NEEDS_MANUAL_RECONCILIATION';
 END IF;
 INSERT INTO public.notifications(user_id,kind,title,body,href,metadata,event_key)
 VALUES(v_listing.seller_id,'donation_requested','Han solicitado tu donación',
        coalesce(v_listing.title,'Tienes una nueva solicitud de donación.'),
        '/messages/'||v_chat::text,
        jsonb_build_object('listing_id',v_listing.id,'donation_request_id',v_req.id,
                           'conversation_id',v_chat),v_key)
 ON CONFLICT(event_key) DO NOTHING;
 SELECT * INTO v_notice FROM public.notifications n WHERE n.event_key=v_key;
 IF NOT FOUND OR v_notice.user_id IS DISTINCT FROM v_listing.seller_id
 OR v_notice.kind IS DISTINCT FROM 'donation_requested'
 OR v_notice.href IS DISTINCT FROM '/messages/'||v_chat::text
 OR v_notice.metadata->>'listing_id' IS DISTINCT FROM v_listing.id::text
 OR v_notice.metadata->>'donation_request_id' IS DISTINCT FROM v_req.id::text
 OR v_notice.metadata->>'conversation_id' IS DISTINCT FROM v_chat::text THEN
   RAISE EXCEPTION 'A039B_NOTIFICATION_MISMATCH';
 END IF;

 UPDATE public.conversations SET updated_at=clock_timestamp() WHERE id=v_chat;
 IF NOT FOUND THEN RAISE EXCEPTION 'A039B_CONVERSATION_TOUCH_FAILED'; END IF;
 DELETE FROM public.hidden_conversations h WHERE h.conversation_id=v_chat
 AND h.user_id IN (p_actor_id,v_listing.seller_id);

 request_id:=v_req.id;
 conversation_id:=v_chat;
 RETURN NEXT;
END;
$a039b$;

REVOKE EXECUTE ON FUNCTION public.r3_reconcile_donation_request_atomic(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.r3_reconcile_donation_request_atomic(uuid,uuid)
 TO service_role;
DO $postflight$
DECLARE v_fn oid:=to_regprocedure('public.r3_reconcile_donation_request_atomic(uuid,uuid)')::oid;
BEGIN
 IF v_fn IS NULL
 OR (SELECT prosecdef FROM pg_proc WHERE oid=v_fn)
 OR has_function_privilege('anon',v_fn,'EXECUTE')
 OR has_function_privilege('authenticated',v_fn,'EXECUTE')
 OR NOT has_function_privilege('service_role',v_fn,'EXECUTE')
 OR EXISTS (SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid=v_fn)) a
            WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
 OR NOT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid='public.donation_request_events_request_created_once_idx'::regclass AND indisunique AND indisvalid AND indisready)
 OR NOT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid='public.messages_donation_event_once_idx'::regclass AND indisunique AND indisvalid AND indisready)
 THEN RAISE EXCEPTION 'NO_GO_A039B_POSTFLIGHT'; END IF;
END $postflight$;
COMMIT;

-- Rollback requires NEW authorization: FIRST disable
-- WETUDY_R3_DONATION_REQUEST_REPAIR_ENABLED and redeploy/verify OFF;
-- THEN DROP FUNCTION exact signature and both new indexes in one transaction;
-- never remove preexisting grants, constraints, indexes or data.
