#!/usr/bin/env bash
# P0 review-only PG17: two real DB connections competing for the SAME listing.
# This script must NEVER target Supabase or any production database.
set -euo pipefail
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "wetudy_p0_synthetic"
test "${PGUSER:-}" = "postgres"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

psql -X -v ON_ERROR_STOP=1 -qAt -c "
 INSERT INTO public.profiles(id) VALUES
  ('77777777-7777-4777-8777-777777777777')
 ON CONFLICT DO NOTHING;" > /dev/null

first="public.p0_buy_now_prepare_atomic_candidate(
 '55555555-5555-4555-8555-555555555555',
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 20.00,'shipping','small',1.00,2.99,23.99)"
second="public.p0_buy_now_prepare_atomic_candidate(
 '55555555-5555-4555-8555-555555555555',
 '77777777-7777-4777-8777-777777777777',
 '22222222-2222-4222-8222-222222222222',
 20.00,'shipping','small',1.00,2.99,23.99)"

# The first transaction holds the row lock after its successful preparation.
PGAPPNAME=wetudy_pg17_buyer_first psql -X -v ON_ERROR_STOP=1 -qAt -c "
 BEGIN;
 SELECT listing_id FROM $first;
 SELECT pg_sleep(3);
 COMMIT;" > "$tmp_dir/first.out" 2>"$tmp_dir/first.err" &
first_pid=$!

# Do not rely on a fixed sleep to establish which connection acquired the
# lock: wait until the first session is inside the hold statement.
ready=0
for i in $(seq 1 45); do
  active="$(psql -X -v ON_ERROR_STOP=1 -qAt -c "
    SELECT count(*) FROM pg_stat_activity
     WHERE application_name='wetudy_pg17_buyer_first'
       AND state='active' AND query LIKE '%pg_sleep(3)%';")"
  if [ "$active" = "1" ]; then ready=1; break; fi
  sleep 0.1
done
if [ "$ready" != "1" ]; then
  wait "$first_pid" || true
  echo "PG17 first buyer never acquired lock" >&2
  exit 1
fi

# A distinct buyer must NOT get a second offer and payment intent while the
# first holds the lock; it waits and then loses after the first commits.
if psql -X -v ON_ERROR_STOP=1 -qAt -c "SELECT listing_id FROM $second;" \
   > "$tmp_dir/second.out" 2>"$tmp_dir/second.err"; then
  wait "$first_pid"
  echo "PG17 double-buy race incorrectly succeeded" >&2
  exit 1
fi
wait "$first_pid"
grep -q "P0_BUY_NOW_LISTING_CHANGED" "$tmp_dir/second.err"

psql -X -v ON_ERROR_STOP=1 -qAt -c "
DO \$test\$
BEGIN
 IF (SELECT status FROM public.listings
     WHERE id='55555555-5555-4555-8555-555555555555')<>'reserved'
 OR (SELECT count(*) FROM public.listing_offers
     WHERE listing_id='55555555-5555-4555-8555-555555555555')<>1
 OR (SELECT count(*) FROM public.payment_intents
     WHERE listing_id='55555555-5555-4555-8555-555555555555')<>1
 OR (SELECT count(*) FROM public.messages m JOIN public.conversations c
     ON m.conversation_id=c.id
     WHERE c.listing_id='55555555-5555-4555-8555-555555555555')<>1
 OR (SELECT count(*) FROM public.listing_offer_events e
     JOIN public.listing_offers o ON e.offer_id=o.id
     WHERE o.listing_id='55555555-5555-4555-8555-555555555555')<>1
 OR (SELECT count(*) FROM public.conversations
     WHERE listing_id='55555555-5555-4555-8555-555555555555')<>1
 OR EXISTS (SELECT 1 FROM public.listing_offers
     WHERE listing_id='55555555-5555-4555-8555-555555555555'
       AND buyer_id='77777777-7777-4777-8777-777777777777')
 THEN RAISE EXCEPTION 'FAIL: concurrent buyers left duplicate checkout rows';
 END IF;
END \$test\$;" >/dev/null

echo "PG17 two-buyer concurrent checkout: single winner, complete rows, PASS"
