#!/usr/bin/env bash
# Real two-session contention ONLY in the GitHub postgres:17 ephemeral service.
set -euo pipefail
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "wetudy_p0_synthetic"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

# The preceding synthetic smoke disables the sample subscription; re-enable
# it to test a distinct month using two genuinely simultaneous DB sessions.
psql -X -v ON_ERROR_STOP=1 -qAt -c "
 UPDATE public.school_impact_report_subscriptions SET enabled=true
 WHERE id='66666666-6666-4666-8666-666666666666';" >/dev/null

claim="public.p0_school_impact_claim_candidate(
 '66666666-6666-4666-8666-666666666666','2026-11',
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',18,
 'synthetic@example.invalid',NULL)"

# Hold the first transaction open after getting the claim, so the second
# worker blocks on the same subscription row and sees the committed winner.
psql -X -v ON_ERROR_STOP=1 -qAt -c "
 BEGIN;
 SELECT $claim;
 SELECT pg_sleep(2);
 COMMIT;" >"$tmp_dir/first" &
worker=$!
sleep 0.35
psql -X -v ON_ERROR_STOP=1 -qAt -c "SELECT $claim;" >"$tmp_dir/second"
wait "$worker"

count="$(psql -X -v ON_ERROR_STOP=1 -qAt -c "
 SELECT count(*) FROM public.p0_school_impact_dispatch_claims_candidate
 WHERE subscription_id='66666666-6666-4666-8666-666666666666'
   AND period_key='2026-11';")"
test "$count" = "1"

winners="$(grep -Eho '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' \
 "$tmp_dir/first" "$tmp_dir/second" | wc -l | tr -d ' ')"
test "$winners" = "1"
echo "PG17 two-worker cron exclusive claim: PASS"
