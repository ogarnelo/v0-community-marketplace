#!/usr/bin/env bash
set -euo pipefail
# WETUDY R3/A-002 — PG17 disposable DB ONLY. Never read DATABASE_URL.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=wetudy_synthetic_pg17 PGCONNECT_TIMEOUT=5
db=wetudy_r3_donation_atomic_synthetic
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
candidate=scripts/review_only/r3_donation_review_atomic_a002_candidate.sql
[[ -f "$candidate" ]] || { echo "Missing candidate" >&2; exit 1; }
createdb "$db"
psql -X -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.schools(id uuid PRIMARY KEY,is_active boolean);
CREATE TABLE public.user_roles(user_id uuid NOT NULL,role text NOT NULL,school_id uuid);
CREATE TABLE public.listings(
 id uuid PRIMARY KEY,
 school_id uuid,
 seller_id uuid,
 title text,
 listing_type text,
 status text,
 updated_at timestamptz
);
CREATE TABLE public.donation_requests(
 id uuid PRIMARY KEY,
 listing_id uuid,
 requester_id uuid,
 school_id uuid,
 status text,
 note text,
 assigned_to_requester_id uuid,
 approved_by_admin_id uuid,
 updated_at timestamptz
);
ALTER TABLE public.donation_requests ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX donation_requests_one_approved_per_listing_idx
 ON public.donation_requests(listing_id)
 WHERE status='approved' AND listing_id IS NOT NULL;
CREATE UNIQUE INDEX donation_requests_one_pending_per_requester_listing_idx
 ON public.donation_requests(listing_id, requester_id)
 WHERE status='pending' AND listing_id IS NOT NULL AND requester_id IS NOT NULL;
GRANT SELECT ON public.schools,public.listings,public.user_roles,public.donation_requests TO service_role;
GRANT UPDATE ON public.schools,public.listings,public.donation_requests TO service_role;
INSERT INTO public.schools(id,is_active) VALUES
 ('11111111-1111-4111-8111-111111111111',true),
 ('99999999-9999-4999-8999-999999999999',false);
INSERT INTO public.user_roles(user_id,role,school_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','school_admin','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','super_admin',NULL),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','school_admin','99999999-9999-4999-8999-999999999999'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','school_admin','11111111-1111-4111-8111-111111111111'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','school_admin','99999999-9999-4999-8999-999999999999');
INSERT INTO public.listings(id,school_id,seller_id,title,listing_type,status) VALUES
 ('11111111-2222-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','ffffffff-ffff-4fff-8fff-ffffffffffff','Donation A','donation','available'),
 ('11111111-3333-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','ffffffff-ffff-4fff-8fff-ffffffffffff','Donation B','donation','available'),
 ('11111111-4444-4111-8111-111111111111','99999999-9999-4999-8999-999999999999','ffffffff-ffff-4fff-8fff-ffffffffffff','Inactive','donation','available');
INSERT INTO public.donation_requests(id,listing_id,requester_id,school_id,status) VALUES
 ('22222222-2222-4222-8222-222222222222','11111111-2222-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','pending'),
 ('33333333-3333-4333-8333-333333333333','11111111-2222-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef','11111111-1111-4111-8111-111111111111','pending'),
 ('44444444-4444-4444-8444-444444444444','11111111-3333-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef','11111111-1111-4111-8111-111111111111','pending'),
 ('55555555-5555-4555-8555-555555555555','11111111-4444-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef','99999999-9999-4999-8999-999999999999','pending');
SQL
psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$candidate" >"$tmp/install.log"
acl=$(psql -XAt -v ON_ERROR_STOP=1 -d "$db" -c "SELECT (has_function_privilege('anon','public.r3_review_donation_atomic(uuid,uuid,text,text)','EXECUTE'))::int || ':' || (has_function_privilege('authenticated','public.r3_review_donation_atomic(uuid,uuid,text,text)','EXECUTE'))::int || ':' || (has_function_privilege('service_role','public.r3_review_donation_atomic(uuid,uuid,text,text)','EXECUTE'))::int")
[[ "$acl" == "0:0:1" ]] || { echo "Unsafe RPC ACL $acl" >&2; exit 1; }

# Invalid user, ambiguous school assignment, and inactive school all deny.
deny() {
  local actor="$1" req="$2" code="$3"
  if psql -X -v ON_ERROR_STOP=1 -d "$db" >"$tmp/deny.log" 2>&1 <<SQL
SET ROLE service_role;
SELECT * FROM public.r3_review_donation_atomic('$actor','$req','approve',NULL);
SQL
  then echo "Unauthorized decision succeeded: $actor" >&2; exit 1; fi
  grep -q "$code" "$tmp/deny.log" || { cat "$tmp/deny.log" >&2; exit 1; }
}
deny 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' '22222222-2222-4222-8222-222222222222' 'R3_DONATION_ROLE_SCOPE_DENIED'
deny 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' '22222222-2222-4222-8222-222222222222' 'R3_DONATION_ROLE_SCOPE_DENIED'
deny 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' '55555555-5555-4555-8555-555555555555' 'R3_DONATION_SCHOOL_INACTIVE'

# Two separate transactions concurrently attempt to approve different requests
# for the SAME listing. The loser must be blocked by the listing lock and reject
# after the winner commits; no partial approve or archive is allowed.
race() {
  local request_id="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$db" <<SQL
SET ROLE service_role;
BEGIN;
SET LOCAL lock_timeout='8s';
SELECT * FROM public.r3_review_donation_atomic(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '$request_id','approve',NULL);
SELECT pg_sleep(0.55);
COMMIT;
SQL
}
(
  touch "$tmp/one.ready"
  timeout 6 bash -c 'while [[ ! -f "$1" ]]; do sleep 0.02; done' _ "$tmp/two.ready"
  race '22222222-2222-4222-8222-222222222222'
) >"$tmp/one.log" 2>&1 &
a=$!
(
  touch "$tmp/two.ready"
  timeout 6 bash -c 'while [[ ! -f "$1" ]]; do sleep 0.02; done' _ "$tmp/one.ready"
  race '33333333-3333-4333-8333-333333333333'
) >"$tmp/two.log" 2>&1 &
b=$!
if wait "$a"; then ar=0; else ar=$?; fi
if wait "$b"; then br=0; else br=$?; fi
if [[ "$ar" == "$br" ]]; then
  echo "Concurrent review expected exactly one winner" >&2
  cat "$tmp/one.log" "$tmp/two.log" >&2; exit 1
fi
if [[ "$ar" == 0 ]]; then loser="$tmp/two.log"; else loser="$tmp/one.log"; fi
grep -q "R3_DONATION_STATUS_CONFLICT" "$loser" || {
  echo "Wrong rejection for losing transaction" >&2
  cat "$loser" >&2; exit 1
}
state=$(psql -XAt -v ON_ERROR_STOP=1 -d "$db" -c "
SELECT (SELECT count(*) FROM public.donation_requests WHERE listing_id='11111111-2222-4111-8111-111111111111' AND status='approved')::text
 || ':' ||
 (SELECT count(*) FROM public.donation_requests WHERE listing_id='11111111-2222-4111-8111-111111111111' AND status='rejected')::text
 || ':' ||
 (SELECT status FROM public.listings WHERE id='11111111-2222-4111-8111-111111111111')")
[[ "$state" == "1:1:archived" ]] || { echo "Incorrect winner state $state" >&2; exit 1; }

# Rejection changes only this request, never archives a donation.
psql -X -v ON_ERROR_STOP=1 -d "$db" >/dev/null <<'SQL'
SET ROLE service_role;
SELECT * FROM public.r3_review_donation_atomic(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '44444444-4444-4444-8444-444444444444','reject','synthetic');
SQL
state2=$(psql -XAt -v ON_ERROR_STOP=1 -d "$db" -c "
SELECT (SELECT status FROM public.donation_requests WHERE id='44444444-4444-4444-8444-444444444444')
 || ':' || (SELECT status FROM public.listings WHERE id='11111111-3333-4111-8111-111111111111')")
[[ "$state2" == "rejected:available" ]] || { echo "Wrong rejection state: $state2" >&2; exit 1; }
echo "R3_A002_ATOMIC_RACE_ONE_WINNER; POSTCOMMIT_SAFE; ROLE_DENIAL; INACTIVE_DENIAL; SERVICE_ONLY; NO_PRODUCTION"
