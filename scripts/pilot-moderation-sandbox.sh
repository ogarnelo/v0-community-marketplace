#!/usr/bin/env bash
# Execute the REAL dispute function from the checked-in migration against a
# disposable PostgreSQL database. No production URL or credentials are used.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable PostgreSQL instance}"
python3 - <<'PY'
from urllib.parse import urlsplit
import os
host = urlsplit(os.environ["DATABASE_URL"]).hostname
if host not in ("localhost", "127.0.0.1", "::1"):
    raise SystemExit("Refusing to run moderation fixture against a nonlocal database")
PY

psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
CREATE TABLE public.agreements (
  id uuid PRIMARY KEY,
  listing_id uuid,
  conversation_id uuid,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  status text NOT NULL,
  disputed_at timestamptz,
  updated_at timestamptz
);
CREATE TABLE public.agreement_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agreement_id uuid NOT NULL, actor_id uuid, event_type text, note text
);
CREATE TABLE public.reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_id uuid, target_type text, agreement_id uuid,
  listing_id uuid, conversation_id uuid, reason text,
  details text, status text
);
CREATE TABLE public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid, sender_id uuid, body text
);
INSERT INTO public.agreements (id, listing_id, conversation_id, buyer_id, seller_id, status) VALUES
('00000000-0000-4000-8000-000000000201',
 '00000000-0000-4000-8000-000000000301',
 '00000000-0000-4000-8000-000000000401',
 '00000000-0000-4000-8000-000000000102',
 '00000000-0000-4000-8000-000000000101', 'confirmed'),
('00000000-0000-4000-8000-000000000202',
 '00000000-0000-4000-8000-000000000302',
 NULL,
 '00000000-0000-4000-8000-000000000102',
 '00000000-0000-4000-8000-000000000101', 'pending'),
('00000000-0000-4000-8000-000000000203',
 '00000000-0000-4000-8000-000000000303',
 NULL,
 '00000000-0000-4000-8000-000000000102',
 '00000000-0000-4000-8000-000000000101', 'confirmed');
SQL

temp="$(mktemp)"
trap 'rm -f "$temp"' EXIT
awk '
  /^create or replace function public\.server_dispute_agreement\(/ { active=1 }
  active { print }
  active && /^\$\$;$/ { exit }
' supabase/migrations/20260918202500_harden_agreement_integrity.sql > "$temp"
grep -q 'returns public.agreements' "$temp" || {
  echo "Dispute function extraction failed" >&2; exit 1;
}
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$temp" > /dev/null

psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
DO $test$
BEGIN
  BEGIN
    PERFORM public.server_dispute_agreement(
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000201', 'outsider');
    RAISE EXCEPTION 'Outsider should not create a dispute';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Not allowed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.server_dispute_agreement(
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000202', 'pending');
    RAISE EXCEPTION 'Pending deal should not be disputed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Only confirmed agreements%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.reports) <> 0
     OR (SELECT count(*) FROM public.agreement_events) <> 0
     OR (SELECT count(*) FROM public.messages) <> 0 THEN
    RAISE EXCEPTION 'Rejected disputes produced side effects';
  END IF;

  PERFORM public.server_dispute_agreement(
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000201',
    'missing delivery');
  IF (SELECT status FROM public.agreements
      WHERE id='00000000-0000-4000-8000-000000000201') <> 'disputed'
     OR (SELECT count(*) FROM public.reports WHERE status='open') <> 1
     OR (SELECT count(*) FROM public.agreement_events
         WHERE event_type='agreement_disputed') <> 1
     OR (SELECT count(*) FROM public.messages) <> 1 THEN
    RAISE EXCEPTION 'Buyer dispute did not produce expected records';
  END IF;
  -- Repeated action must be idempotent and not create duplicate cases/messages.
  PERFORM public.server_dispute_agreement(
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000201', 'duplicate');
  IF (SELECT count(*) FROM public.reports) <> 1
     OR (SELECT count(*) FROM public.messages) <> 1 THEN
    RAISE EXCEPTION 'Duplicate dispute created another case';
  END IF;

  -- A seller can dispute a separate confirmed agreement; no conversation => no message.
  PERFORM public.server_dispute_agreement(
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000203', 'item condition');
  IF (SELECT count(*) FROM public.reports) <> 2
     OR (SELECT count(*) FROM public.agreement_events) <> 2
     OR (SELECT count(*) FROM public.messages) <> 1 THEN
    RAISE EXCEPTION 'Seller dispute behavior unexpected';
  END IF;
END
$test$;
SQL
echo "Isolated dispute SQL assertions passed (buyer, seller, outsider, pending, idempotency)."
