#!/usr/bin/env bash
set -euo pipefail
: "$DATABASE_URL"
case "$DATABASE_URL" in
  *"@127.0.0.1:5432/"*) ;;
  *) echo "REFUSED: needs disposable local PostgreSQL 17" >&2; exit 2 ;;
esac
export PGCONNECT_TIMEOUT=5
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
UPDATE public.donation_requests SET status='pending'
WHERE id IN ('77777777-7777-4777-8777-777777777777','99999999-9999-4999-8999-999999999999');" >/dev/null
rm -f /tmp/wetudy_591_a.ready /tmp/wetudy_591_b.ready
run_a() {
 psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL statement_timeout='12s';
SET LOCAL lock_timeout='10s';
\! touch /tmp/wetudy_591_a.ready
\! timeout 8 sh -c 'while [ ! -f /tmp/wetudy_591_b.ready ]; do sleep .05; done'
UPDATE public.donation_requests SET status='approved'
 WHERE id='77777777-7777-4777-8777-777777777777';
SELECT pg_sleep(1);
COMMIT;
SQL
}
run_b() {
 psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL statement_timeout='12s';
SET LOCAL lock_timeout='10s';
\! touch /tmp/wetudy_591_b.ready
\! timeout 8 sh -c 'while [ ! -f /tmp/wetudy_591_a.ready ]; do sleep .05; done'
UPDATE public.donation_requests SET status='approved'
 WHERE id='99999999-9999-4999-8999-999999999999';
SELECT pg_sleep(1);
COMMIT;
SQL
}
run_a >/tmp/wetudy_591_a.log 2>&1 &
a=$!
run_b >/tmp/wetudy_591_b.log 2>&1 &
b=$!
if wait "$a"; then as=0; else as=$?; fi
if wait "$b"; then bs=0; else bs=$?; fi
if [ "$as" -eq "$bs" ]; then
 echo "ERROR: exactly one transaction must commit" >&2
 cat /tmp/wetudy_591_a.log /tmp/wetudy_591_b.log >&2
 exit 1
fi
if [ "$as" -eq 0 ]; then loser=/tmp/wetudy_591_b.log; else loser=/tmp/wetudy_591_a.log; fi
if ! grep -q "donation_requests_one_approved_per_listing_idx" "$loser"; then
 echo "ERROR: loser must fail due to the expected unique index" >&2
 cat "$loser" >&2
 exit 1
fi
count=$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "
 SELECT count(*) FROM public.donation_requests
 WHERE listing_id='11111111-1111-4111-8111-111111111111'
 AND status='approved';")
if [ "$count" != "1" ]; then echo "ERROR: expected exactly one approved, got $count" >&2; exit 1; fi
echo "PG17_CONCURRENT_TWO_TRANSACTIONS_ONE_WINNER; UNIQUE ENFORCED; NO PRODUCTION"
