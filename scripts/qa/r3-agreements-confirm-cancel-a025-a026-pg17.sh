#!/usr/bin/env bash
set -euo pipefail
# WETUDY R3 A-025/A-026: PostgreSQL 17 isolated, synthetic data ONLY.
# Never accept DATABASE_URL or remote hosts. DB is disposed with CI service.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=wetudy_synthetic_pg17 PGCONNECT_TIMEOUT=5
db=wetudy_r3_agreements_synthetic
candidate=scripts/review_only/r3_agreements_confirm_cancel_a025_a026_candidate.sql
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
[[ -f "$candidate" ]] || exit 1
createdb "$db"
psql -X -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.listings (
  id uuid PRIMARY KEY, status text NOT NULL, updated_at timestamptz
);
CREATE TABLE public.agreements (
  id uuid PRIMARY KEY, listing_id uuid NOT NULL,
  buyer_id uuid NOT NULL, seller_id uuid NOT NULL,
  conversation_id uuid, agreement_type text NOT NULL DEFAULT 'sale',
  status text NOT NULL,
  buyer_confirmed_at timestamptz, seller_confirmed_at timestamptz,
  confirmed_at timestamptz, cancelled_at timestamptz,
  updated_at timestamptz
);
CREATE TABLE public.listing_offers(listing_id uuid,status text);
CREATE TABLE public.donation_requests(listing_id uuid,status text);
CREATE TABLE public.agreement_events(agreement_id uuid,actor_id uuid,event_type text,note text,metadata jsonb);
CREATE TABLE public.messages(conversation_id uuid,sender_id uuid,body text);
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.server_confirm_agreement(p_actor_id uuid,p_agreement_id uuid)
RETURNS public.agreements LANGUAGE plpgsql SECURITY INVOKER
AS $$BEGIN RAISE EXCEPTION 'STALE_STUB'; END;$$;
CREATE FUNCTION public.server_cancel_agreement(p_actor_id uuid,p_agreement_id uuid,p_note text DEFAULT NULL)
RETURNS public.agreements LANGUAGE plpgsql SECURITY INVOKER
AS $$BEGIN RAISE EXCEPTION 'STALE_STUB'; END;$$;
REVOKE EXECUTE ON FUNCTION public.server_confirm_agreement(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.server_cancel_agreement(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.server_confirm_agreement(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.server_cancel_agreement(uuid,uuid,text) TO service_role;
GRANT SELECT,UPDATE ON public.listings,public.agreements TO service_role;
GRANT SELECT ON public.listing_offers,public.donation_requests TO service_role;
GRANT INSERT ON public.agreement_events,public.messages TO service_role;
SQL
psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$candidate" >"$tmp/install.log"
acl=$(psql -XAt -v ON_ERROR_STOP=1 -d "$db" -c "SELECT (has_function_privilege('anon','public.server_confirm_agreement(uuid,uuid)','EXECUTE'))::int || ':' || (has_function_privilege('authenticated','public.server_confirm_agreement(uuid,uuid)','EXECUTE'))::int || ':' || (has_function_privilege('service_role','public.server_confirm_agreement(uuid,uuid)','EXECUTE'))::int")
[[ "$acl" == "0:0:1" ]] || { echo "Unsafe confirm ACL: $acl" >&2; exit 1; }

# Two independent conversations negotiate one listing; only one can close.
psql -X -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
INSERT INTO public.listings (id,status) VALUES
 ('11111111-1111-4111-8111-111111111111','reserved'),
 ('22222222-2222-4222-8222-222222222222','reserved'),
 ('33333333-3333-4333-8333-333333333333','reserved'),
 ('44444444-4444-4444-8444-444444444444','reserved'),
 ('55555555-5555-4555-8555-555555555555','reserved'),
 ('66666666-6666-4666-8666-666666666666','reserved');
INSERT INTO public.agreements
 (id,listing_id,buyer_id,seller_id,conversation_id,status,agreement_type,seller_confirmed_at)
 VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','seller_confirmed','sale',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-ddddddddddd2','seller_confirmed','sale',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-ddddddddddd3','buyer_confirmed','sale',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-ddddddddddd4','buyer_confirmed','sale',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','33333333-3333-4333-8333-333333333333','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-ddddddddddd5','buyer_confirmed','sale',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6','44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-ddddddddddd6','buyer_confirmed','sale',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7','55555555-5555-4555-8555-555555555555','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-ddddddddddd7','buyer_confirmed','sale',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8','66666666-6666-4666-8666-666666666666','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-ddddddddddd8','buyer_confirmed','sale',now());
INSERT INTO public.listing_offers (listing_id,status)
 VALUES ('44444444-4444-4444-8444-444444444444','accepted');
INSERT INTO public.donation_requests (listing_id,status)
 VALUES ('55555555-5555-4555-8555-555555555555','approved');
SQL
finish_one() {
 local actor="$1" ag="$2"
 psql -X -v ON_ERROR_STOP=1 -d "$db" <<SQL
SET ROLE service_role;
BEGIN;
SET LOCAL lock_timeout='8s';
SELECT id,status FROM public.server_confirm_agreement('$actor','$ag');
SELECT pg_sleep(0.5);
COMMIT;
SQL
}
(
  touch "$tmp/a.ready"
  timeout 6 bash -c 'while [[ ! -f "$1" ]]; do sleep 0.02; done' _ "$tmp/b.ready"
  finish_one 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
) >"$tmp/a.log" 2>&1 &
ap=$!
(
  touch "$tmp/b.ready"
  timeout 6 bash -c 'while [[ ! -f "$1" ]]; do sleep 0.02; done' _ "$tmp/a.ready"
  finish_one 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
) >"$tmp/b.log" 2>&1 &
bp=$!
if wait "$ap"; then ra=0; else ra=$?; fi
if wait "$bp"; then rb=0; else rb=$?; fi
if [[ "$ra" == "$rb" ]]; then
 echo "A025: expected exactly one winner" >&2; cat "$tmp/a.log" "$tmp/b.log" >&2; exit 1
fi
if [[ "$ra" == "0" ]]; then loser="$tmp/b.log"; else loser="$tmp/a.log"; fi
grep -q "Listing no longer accepts agreement confirmation" "$loser" || {
 echo "A025: losing RPC did not fail for the expected reason" >&2; cat "$loser" >&2; exit 1
}
winner=$(psql -XAt -d "$db" -c "SELECT (SELECT count(*) FROM public.agreements WHERE listing_id='11111111-1111-4111-8111-111111111111' AND status='confirmed') || ':' || (SELECT status FROM public.listings WHERE id='11111111-1111-4111-8111-111111111111') || ':' || (SELECT count(*) FROM public.agreement_events WHERE event_type='agreement_confirmed') || ':' || (SELECT count(*) FROM public.messages)")
[[ "$winner" == "1:sold:1:1" ]] || { echo "A025 inconsistent transaction $winner" >&2; exit 1; }

# Cancellation of a sole holder reopens, but never releases another live
# agreement / accepted offer / approved donation.
psql -X -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
SET ROLE service_role;
SELECT id,status FROM public.server_cancel_agreement(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',NULL);
SELECT id,status FROM public.server_cancel_agreement(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',NULL);
SQL
c1=$(psql -XAt -d "$db" -c "SELECT (SELECT status FROM public.listings WHERE id='22222222-2222-4222-8222-222222222222') || ':' || (SELECT status FROM public.listings WHERE id='33333333-3333-4333-8333-333333333333')")
[[ "$c1" == "available:reserved" ]] || { echo "A026 release of other reservation $c1" >&2; exit 1; }
psql -X -v ON_ERROR_STOP=1 -d "$db" >/dev/null <<'SQL'
SET ROLE service_role;
SELECT id,status FROM public.server_cancel_agreement(
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',NULL);
SELECT id,status FROM public.server_cancel_agreement(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',NULL);
SELECT id,status FROM public.server_cancel_agreement(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',NULL);
SQL
c2=$(psql -XAt -d "$db" -c "SELECT (SELECT status FROM public.listings WHERE id='33333333-3333-4333-8333-333333333333') || ':' || (SELECT status FROM public.listings WHERE id='44444444-4444-4444-8444-444444444444') || ':' || (SELECT status FROM public.listings WHERE id='55555555-5555-4555-8555-555555555555')")
[[ "$c2" == "available:reserved:reserved" ]] || { echo "A026 offer/donation ownership $c2" >&2; exit 1; }

# A proposal arrives while cancellation waits for its locked listing:
# cancel must inspect the new claim after obtaining the listing lock.
(
  psql -X -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
BEGIN;
SELECT id FROM public.listings WHERE id='66666666-6666-4666-8666-666666666666' FOR UPDATE;
INSERT INTO public.agreements (id,listing_id,buyer_id,seller_id,conversation_id,status,agreement_type)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9','66666666-6666-4666-8666-666666666666','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-ddddddddddd9','proposed','sale');
SELECT pg_sleep(0.8);
COMMIT;
SQL
) >"$tmp/claim.log" 2>&1 &
claim=$!
sleep 0.15
psql -X -v ON_ERROR_STOP=1 -d "$db" >"$tmp/cancel.log" 2>&1 <<'SQL'
SET ROLE service_role;
SELECT id,status FROM public.server_cancel_agreement(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8',NULL);
SQL
wait "$claim"
final=$(psql -XAt -d "$db" -c "SELECT status FROM public.listings WHERE id='66666666-6666-4666-8666-666666666666'")
[[ "$final" == "reserved" ]] || { echo "A026 concurrent proposal reopened listing $final" >&2; exit 1; }

# A different flow's accepted offer forbids confirming an agreement.
psql -X -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
INSERT INTO public.agreements (id,listing_id,buyer_id,seller_id,conversation_id,status,agreement_type,seller_confirmed_at)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10','44444444-4444-4444-8444-444444444444','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddda0','seller_confirmed','sale',now());
SQL
if psql -X -v ON_ERROR_STOP=1 -d "$db" >"$tmp/offer.log" 2>&1 <<'SQL'
SET ROLE service_role;
SELECT id,status FROM public.server_confirm_agreement(
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10');
SQL
then echo "A025 accepted offer allowed second confirmation" >&2; exit 1; fi
grep -q "Listing already allocated outside" "$tmp/offer.log" || { cat "$tmp/offer.log" >&2; exit 1; }
echo "R3_A025_A026_PG17_ONE_CONFIRMATION; TWO_CONVERSATIONS; NO_FALSE_REOPEN; CROSS_FLOW_GUARD; ACL; NO_PRODUCTION"
