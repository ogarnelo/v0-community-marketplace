#!/usr/bin/env bash
set -euo pipefail
# WETUDY A-039b PostgreSQL 17 SYNTHETIC service. Never use remote credentials.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres \
 PGPASSWORD=wetudy_synthetic_pg17 PGCONNECT_TIMEOUT=5
DB=wetudy_r3_a039b_synthetic
CANDIDATE=scripts/review_only/r3_donation_request_reconcile_atomic_a039b_candidate.sql
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
[[ -f "$CANDIDATE" ]] || { echo "Missing SQL candidate" >&2; exit 1; }
createdb "$DB"
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.listings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),listing_type text,type text,
 status text DEFAULT 'available',title text NOT NULL,seller_id uuid,school_id uuid
);
CREATE TABLE public.donation_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),listing_id uuid,
 requester_id uuid,school_id uuid,status text DEFAULT 'pending',note text
);
CREATE TABLE public.conversations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),listing_id uuid,
 buyer_id uuid,seller_id uuid,updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.donation_request_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL,
 conversation_id uuid,actor_id uuid NOT NULL,event_type text NOT NULL,
 note text,status_snapshot text NOT NULL
);
CREATE TABLE public.messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid,sender_id uuid,body text
);
CREATE TABLE public.notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,
 kind text NOT NULL,title text NOT NULL,body text,href text,
 metadata jsonb,event_key text
);
CREATE TABLE public.hidden_conversations(
 user_id uuid NOT NULL,conversation_id uuid NOT NULL,
 PRIMARY KEY(user_id,conversation_id)
);
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['listings','donation_requests','conversations',
 'donation_request_events','messages','notifications','hidden_conversations'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 END LOOP;
END$$;
GRANT USAGE ON SCHEMA public TO service_role;
CREATE UNIQUE INDEX conversations_listing_buyer_seller_idx
 ON public.conversations(listing_id,buyer_id,seller_id);
CREATE UNIQUE INDEX notifications_event_key_uidx
 ON public.notifications(event_key);
CREATE UNIQUE INDEX donation_requests_one_pending_per_requester_listing_idx
 ON public.donation_requests(listing_id,requester_id)
 WHERE status='pending' AND listing_id IS NOT NULL AND requester_id IS NOT NULL;
SQL
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f "$CANDIDATE" >"$T/install"
acl=$(psql -XAt -d "$DB" -c "SELECT
 (has_function_privilege('anon','public.r3_reconcile_donation_request_atomic(uuid,uuid)','EXECUTE'))::int||':'||
 (has_function_privilege('authenticated','public.r3_reconcile_donation_request_atomic(uuid,uuid)','EXECUTE'))::int||':'||
 (has_function_privilege('service_role','public.r3_reconcile_donation_request_atomic(uuid,uuid)','EXECUTE'))::int")
[[ "$acl" == "0:0:1" ]] || { echo "Unsafe RPC grants: $acl" >&2; exit 1; }

psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
INSERT INTO public.listings(id,listing_type,type,status,title,seller_id,school_id)
SELECT ('11111111-1111-4111-8111-'||lpad(n::text,12,'0'))::uuid,
 'donation','donation',CASE WHEN n=5 THEN 'archived' ELSE 'available' END,
 'Material escolar','33333333-3333-4333-8333-333333333333',
 '44444444-4444-4444-8444-444444444444' FROM generate_series(1,5) n;
INSERT INTO public.donation_requests(id,listing_id,requester_id,school_id,status,note)
SELECT ('55555555-5555-4555-8555-'||lpad(n::text,12,'0'))::uuid,
 ('11111111-1111-4111-8111-'||lpad(n::text,12,'0'))::uuid,
 '22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444','pending','Libro | lápiz'
 FROM generate_series(1,5) n;
SQL

# First request and replay: one conversation, event, message, notification.
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET ROLE service_role;
SELECT * FROM public.r3_reconcile_donation_request_atomic(
 '55555555-5555-4555-8555-000000000001',
 '22222222-2222-4222-8222-222222222222');
SELECT * FROM public.r3_reconcile_donation_request_atomic(
 '55555555-5555-4555-8555-000000000001',
 '22222222-2222-4222-8222-222222222222');
SQL
first=$(psql -XAt -d "$DB" -c "SELECT
 (SELECT count(*) FROM public.conversations WHERE listing_id='11111111-1111-4111-8111-000000000001')||':'||
 (SELECT count(*) FROM public.donation_request_events WHERE request_id='55555555-5555-4555-8555-000000000001')||':'||
 (SELECT count(*) FROM public.messages m JOIN public.donation_request_events e
 ON m.body LIKE '🎁 DONATION_EVENT|'||e.id::text||'|%'
 WHERE e.request_id='55555555-5555-4555-8555-000000000001')||':'||
 (SELECT count(*) FROM public.notifications WHERE event_key='donation-request:55555555-5555-4555-8555-000000000001:created')")
[[ "$first" == "1:1:1:1" ]] || { echo "First/replay duplicate: $first" >&2;exit 1; }

# Repair a legacy partial: conversation/event already persisted.
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
INSERT INTO public.conversations(id,listing_id,buyer_id,seller_id)
VALUES('66666666-6666-4666-8666-000000000003',
'11111111-1111-4111-8111-000000000003',
'22222222-2222-4222-8222-222222222222',
'33333333-3333-4333-8333-333333333333');
INSERT INTO public.donation_request_events
(id,request_id,conversation_id,actor_id,event_type,note,status_snapshot)
VALUES('77777777-7777-4777-8777-000000000003',
'55555555-5555-4555-8555-000000000003',
'66666666-6666-4666-8666-000000000003',
'22222222-2222-4222-8222-222222222222',
'request_created','Libro | lápiz','pending');
INSERT INTO public.hidden_conversations(user_id,conversation_id)
VALUES('33333333-3333-4333-8333-333333333333',
'66666666-6666-4666-8666-000000000003');
SET ROLE service_role;
SELECT * FROM public.r3_reconcile_donation_request_atomic(
'55555555-5555-4555-8555-000000000003',
'22222222-2222-4222-8222-222222222222');
SQL
partial=$(psql -XAt -d "$DB" -c "SELECT
 (SELECT count(*) FROM public.donation_request_events WHERE request_id='55555555-5555-4555-8555-000000000003')||':'||
 (SELECT count(*) FROM public.messages WHERE body LIKE '🎁 DONATION_EVENT|77777777-7777-4777-8777-000000000003|%')||':'||
 (SELECT count(*) FROM public.notifications WHERE event_key='donation-request:55555555-5555-4555-8555-000000000003:created')||':'||
 (SELECT count(*) FROM public.hidden_conversations WHERE conversation_id='66666666-6666-4666-8666-000000000003')")
[[ "$partial" == "1:1:1:0" ]] || { echo "Partial not repaired $partial" >&2;exit 1; }

# Parallel RPC calls against the same request serialize on the row lock.
parallel(){
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET ROLE service_role;
BEGIN;
SELECT * FROM public.r3_reconcile_donation_request_atomic(
 '55555555-5555-4555-8555-000000000002',
 '22222222-2222-4222-8222-222222222222');
SELECT pg_sleep(0.5);
COMMIT;
SQL
}
parallel >"$T/a" 2>&1 & pa=$!
parallel >"$T/b" 2>&1 & pb=$!
wait "$pa" || { cat "$T/a";exit 1; }
wait "$pb" || { cat "$T/b";exit 1; }
race=$(psql -XAt -d "$DB" -c "SELECT
 (SELECT count(*) FROM public.donation_request_events WHERE request_id='55555555-5555-4555-8555-000000000002')||':'||
 (SELECT count(*) FROM public.messages WHERE body LIKE '%55555555-5555-4555-8555-000000000002%')||':'||
 (SELECT count(*) FROM public.notifications WHERE event_key='donation-request:55555555-5555-4555-8555-000000000002:created')")
[[ "$race" == "1:1:1" ]] || { echo "Concurrent race created duplicates $race" >&2;exit 1; }

# Simulated notification provider/db failure rolls back event/message/chat.
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
CREATE FUNCTION public.qa_block_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.event_key='donation-request:55555555-5555-4555-8555-000000000004:created'
 THEN RAISE EXCEPTION 'QA_BLOCK_NOTIFICATION'; END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER qa_block_notice BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.qa_block_notice();
SQL
if psql -X -v ON_ERROR_STOP=1 -d "$DB" >"$T/fail" 2>&1 <<'SQL'
SET ROLE service_role;
SELECT * FROM public.r3_reconcile_donation_request_atomic(
 '55555555-5555-4555-8555-000000000004',
 '22222222-2222-4222-8222-222222222222');
SQL
then echo "Fail injection was ignored" >&2;exit 1; fi
grep -q QA_BLOCK_NOTIFICATION "$T/fail" || { cat "$T/fail";exit 1; }
rolled=$(psql -XAt -d "$DB" -c "SELECT
 (SELECT count(*) FROM public.conversations WHERE listing_id='11111111-1111-4111-8111-000000000004')||':'||
 (SELECT count(*) FROM public.donation_request_events WHERE request_id='55555555-5555-4555-8555-000000000004')||':'||
 (SELECT count(*) FROM public.messages WHERE body LIKE '%55555555-5555-4555-8555-000000000004%')")
[[ "$rolled" == "0:0:0" ]] || { echo "Atomic rollback failed $rolled" >&2;exit 1; }
psql -X -v ON_ERROR_STOP=1 -d "$DB" -c 'DROP TRIGGER qa_block_notice ON public.notifications' >/dev/null

# Reconciliation after rollback should succeed.
psql -X -v ON_ERROR_STOP=1 -d "$DB" <<'SQL'
SET ROLE service_role;
SELECT * FROM public.r3_reconcile_donation_request_atomic(
 '55555555-5555-4555-8555-000000000004',
 '22222222-2222-4222-8222-222222222222');
SQL

# Foreign requester and archived listing are denied, with no new effects.
for actor in '33333333-3333-4333-8333-333333333333' \
             '22222222-2222-4222-8222-222222222222'; do
 if psql -X -v ON_ERROR_STOP=1 -d "$DB" >"$T/denied" 2>&1 <<SQL
SET ROLE service_role;
SELECT * FROM public.r3_reconcile_donation_request_atomic(
 '55555555-5555-4555-8555-000000000005','$actor');
SQL
 then echo "Foreign actor/archived listing allowed" >&2;exit 1; fi
 grep -q A039B_REQUEST_CONTEXT_CONFLICT "$T/denied"
done
# UNIQUE event-ID message fence rejects an altered body for the same event.
if psql -X -v ON_ERROR_STOP=1 -d "$DB" >"$T/duplicate" 2>&1 <<'SQL'
INSERT INTO public.messages(conversation_id,sender_id,body)
SELECT conversation_id,actor_id,'🎁 DONATION_EVENT|'||id::text||'|fake|request_created|pending|DIFFERENT'
FROM public.donation_request_events
WHERE request_id='55555555-5555-4555-8555-000000000001';
SQL
then echo "Duplicate event chat accepted" >&2;exit 1; fi
grep -qi "duplicate key value" "$T/duplicate" || { cat "$T/duplicate";exit 1; }
echo "A039B_PG17_PASS: new request, replay, partial recovery, concurrency, rollback, ACL and scope — SYNTHETIC ONLY"
