#!/usr/bin/env bash
# Disposable PG17-only fixture. Never connects to Supabase or any email provider.
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=wetudy_synthetic_pg17 PGDATABASE=postgres
PSQL=(psql -X -v ON_ERROR_STOP=1 -q -At)
SQL_FILE="docs/pilot/sql/p0_alert_pause_outbox_review_only_20261119.sql"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
"${PSQL[@]}" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO service_role,anon,authenticated;
CREATE TABLE public.marketplace_alert_outbox(
 listing_id uuid PRIMARY KEY,
 state text NOT NULL DEFAULT 'pending',
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '48 hours',
 lease_token uuid,
 lease_until timestamptz,
 last_error_code text
);
ALTER TABLE public.marketplace_alert_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketplace_alert_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON TABLE public.marketplace_alert_outbox TO service_role;
INSERT INTO public.marketplace_alert_outbox(listing_id,state,attempts,lease_token,lease_until,expires_at)
VALUES('11111111-1111-4111-8111-111111111111','processing',3,
  '22222222-2222-4222-8222-222222222222',now()+interval '2 minutes',
  now()+interval '3 hours');
SQL
"${PSQL[@]}" -f "$SQL_FILE" >/dev/null
"${PSQL[@]}" <<'SQL' > "$tmp"
SET ROLE service_role;
-- A forged token must not disturb current processing lease.
SELECT public.marketplace_alert_pause_outbox_v1(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333');
SELECT state||':'||attempts FROM public.marketplace_alert_outbox;
-- Real lease removes only the one claim attempt. Earlier two failures remain.
SELECT public.marketplace_alert_pause_outbox_v1(
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222');
SELECT state||':'||attempts||':'||last_error_code FROM public.marketplace_alert_outbox;
SELECT lease_token IS NULL AND lease_until IS NULL AND
       next_attempt_at > now()+interval '14 minutes'
  FROM public.marketplace_alert_outbox;
-- Replayed lease is stale.
SELECT public.marketplace_alert_pause_outbox_v1(
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222');
RESET ROLE;
SELECT has_function_privilege('anon',
 'public.marketplace_alert_pause_outbox_v1(uuid,uuid)','EXECUTE');
SELECT has_function_privilege('authenticated',
 'public.marketplace_alert_pause_outbox_v1(uuid,uuid)','EXECUTE');
SQL
expected=$'f\nprocessing:3\nt\npending:2:alerts_paused\nt\nf\nf\nf'
[[ "$(cat "$tmp")" == "$expected" ]] || {
 echo "PG17 alert pause fencing/attempts/ACL did not match expected synthetic state" >&2
 exit 1
}
echo "PG17 alert pause: retained failures, fenced lease, backoff and client ACL PASS"
