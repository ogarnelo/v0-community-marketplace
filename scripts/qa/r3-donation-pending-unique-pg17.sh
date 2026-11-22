#!/usr/bin/env bash
set -euo pipefail
# WETUDY R3 A-015 — offline-only PG17 harness; no Supabase host is accepted.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=wetudy_synthetic_pg17
export PGCONNECT_TIMEOUT=5
db=wetudy_r3_donation_pending_synthetic
candidate=scripts/review_only/r3_donation_pending_unique_candidate.sql
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

if [[ ! -f "$candidate" ]]; then
  echo "Missing R3 candidate" >&2; exit 1
fi
# Exclusive synthetic database; NEVER accept URLs or remote connections.
createdb "$db"
psql -X -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
CREATE TABLE public.donation_requests (
  id uuid PRIMARY KEY,
  listing_id uuid,
  requester_id uuid,
  school_id uuid,
  status text NOT NULL
);
ALTER TABLE public.donation_requests ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX donation_requests_one_approved_per_listing_idx
  ON public.donation_requests (listing_id)
  WHERE status='approved' AND listing_id IS NOT NULL;
SQL

psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$candidate" >/dev/null
flag=$(psql -XAt -v ON_ERROR_STOP=1 -d "$db" -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='donation_requests' AND indexname='donation_requests_one_pending_per_requester_listing_idx'")
[[ "$flag" == "1" ]] || { echo "A015 index was not created" >&2; exit 1; }

# A production-like race in two independent PG transactions:
# both bypass the JS SELECT and attempt the same pending insert.
run_tx() {
  local id="$1"
  psql -X -v ON_ERROR_STOP=1 -d "$db" <<SQL
BEGIN;
SET LOCAL statement_timeout='10s';
INSERT INTO public.donation_requests(id,listing_id,requester_id,school_id,status)
 VALUES('$id','11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444','pending');
SELECT pg_sleep(0.7);
COMMIT;
SQL
}
(
  touch "$tmp/a.ready"
  timeout 6 bash -c 'while [[ ! -f "$1" ]]; do sleep 0.02; done' _ "$tmp/b.ready"
  run_tx 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
) >"$tmp/a.log" 2>&1 &
a=$!
(
  touch "$tmp/b.ready"
  timeout 6 bash -c 'while [[ ! -f "$1" ]]; do sleep 0.02; done' _ "$tmp/a.ready"
  run_tx 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
) >"$tmp/b.log" 2>&1 &
b=$!
if wait "$a"; then ar=0; else ar=$?; fi
if wait "$b"; then br=0; else br=$?; fi
if [[ "$ar" == "$br" ]]; then
  echo "Expected exactly one successful pending insert" >&2
  cat "$tmp/a.log" "$tmp/b.log" >&2
  exit 1
fi
if [[ "$ar" == "0" ]]; then loser="$tmp/b.log"; else loser="$tmp/a.log"; fi
grep -q "donation_requests_one_pending_per_requester_listing_idx" "$loser" || {
  echo "Loser did not fail on the intended unique constraint" >&2
  cat "$loser" >&2; exit 1
}
count=$(psql -XAt -v ON_ERROR_STOP=1 -d "$db" -c "SELECT count(*) FROM public.donation_requests WHERE listing_id='11111111-1111-4111-8111-111111111111' AND requester_id='22222222-2222-4222-8222-222222222222' AND status='pending'")
[[ "$count" == "1" ]] || { echo "Expected one pending row, got $count" >&2; exit 1; }

# Other requesters remain permitted. Reapplication after the old pending
# request becomes rejected also remains permitted; cross-school requesters
# are not restricted by this index (school_id is not in its predicate).
psql -X -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
INSERT INTO public.donation_requests(id,listing_id,requester_id,school_id,status)
 VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '11111111-1111-4111-8111-111111111111',
        '33333333-3333-4333-8333-333333333333',
        '55555555-5555-4555-8555-555555555555','pending');
UPDATE public.donation_requests SET status='rejected'
 WHERE requester_id='22222222-2222-4222-8222-222222222222' AND status='pending';
INSERT INTO public.donation_requests(id,listing_id,requester_id,school_id,status)
 VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '55555555-5555-4555-8555-555555555555','pending');
SQL

# Preflight must REFUSE to install when actual pending duplicates exist,
# leaving the transaction uncommitted and the original approved index intact.
psql -X -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
DROP INDEX public.donation_requests_one_pending_per_requester_listing_idx;
INSERT INTO public.donation_requests(id,listing_id,requester_id,school_id,status)
 VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '55555555-5555-4555-8555-555555555555','pending');
SQL
if psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$candidate" >"$tmp/preflight.log" 2>&1; then
  echo "Candidate must fail closed when pending duplicates exist" >&2; exit 1
fi
grep -q "NO_GO_R3_A015_DUPLICATE_PENDING_GROUPS" "$tmp/preflight.log" || {
  cat "$tmp/preflight.log" >&2; exit 1
}
asserted=$(psql -XAt -v ON_ERROR_STOP=1 -d "$db" -c "SELECT (to_regclass('public.donation_requests_one_pending_per_requester_listing_idx') IS NULL)::int || ':' || (to_regclass('public.donation_requests_one_approved_per_listing_idx') IS NOT NULL)::int")
[[ "$asserted" == "1:1" ]] || { echo "Failed preflight changed index state: $asserted" >&2; exit 1; }

echo "R3_A015_PG17_CONCURRENT_ONE_PENDING_PER_REQUESTER; REAPPLY_ALLOWED; PREFLIGHT_REFUSES_DUPLICATES; NO_PRODUCTION"
