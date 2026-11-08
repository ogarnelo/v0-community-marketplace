#!/usr/bin/env bash
# Real moderation-resolution SQL from the checked-in migration, synthetic
# reports and users only, against disposable localhost PostgreSQL.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to local test PostgreSQL}"
python3 - <<'PY'
import os
from urllib.parse import urlsplit
u = urlsplit(os.environ["DATABASE_URL"])
if u.scheme not in ("postgres", "postgresql") or u.hostname not in ("127.0.0.1","localhost","::1"):
    raise SystemExit("Refusing to test moderation resolution against nonlocal DB")
PY

psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
CREATE TABLE public.user_roles (user_id uuid, role text, school_id uuid);
CREATE TABLE public.agreements (
  id uuid PRIMARY KEY,
  status text NOT NULL, disputed_at timestamptz, updated_at timestamptz
);
CREATE TABLE public.reports (
  id uuid PRIMARY KEY,
  reporter_id uuid NOT NULL, target_type text NOT NULL,
  agreement_id uuid, listing_id uuid, conversation_id uuid,
  status text NOT NULL, resolution_note text, resolved_at timestamptz,
  resolved_by uuid
);
CREATE TABLE public.agreement_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agreement_id uuid, actor_id uuid, event_type text, note text, metadata jsonb
);
CREATE TABLE public.notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid, kind text, title text, body text, href text, metadata jsonb
);
INSERT INTO public.user_roles VALUES
('00000000-0000-4000-8000-000000000101','school_admin','00000000-0000-4000-8000-000000000201'),
('00000000-0000-4000-8000-000000000102','super_admin',null);
INSERT INTO public.agreements(id,status) VALUES
('00000000-0000-4000-8000-000000000301','disputed'),
('00000000-0000-4000-8000-000000000302','disputed');
INSERT INTO public.reports(id,reporter_id,target_type,agreement_id,status) VALUES
('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000501','agreement','00000000-0000-4000-8000-000000000301','open'),
('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000502','agreement','00000000-0000-4000-8000-000000000301','reviewing'),
('00000000-0000-4000-8000-000000000403','00000000-0000-4000-8000-000000000503','agreement','00000000-0000-4000-8000-000000000302','open');
SQL
# Extract actual four-argument RPC rather than maintaining a test copy.
script="$(mktemp)"
trap 'rm -f "$script"' EXIT
python3 - "$script" <<'PY'
from pathlib import Path
import sys
src = Path("supabase/migrations/20261108195500_report_status_idempotent_notifications.sql").read_text()
start = src.lower().find("create or replace function public.server_update_report_status(")
if start < 0:
    raise SystemExit("Missing moderation resolution function")
end = src.find("$$;", start)
if end < 0:
    raise SystemExit("Missing moderation resolution function body terminator")
definition = src[start:end + 3]
if "p_resolution_note text" not in definition:
    raise SystemExit("Unexpected moderation function overload")
Path(sys.argv[1]).write_text(definition + "\n")
PY
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$script" > /dev/null

psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
DO $test$
DECLARE v_label text;
BEGIN
  -- School admin is never allowed to resolve a report, even from own school.
  BEGIN
    PERFORM public.server_update_report_status(
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000401',
      'resolved','unauthorized');
    RAISE EXCEPTION 'School admin was allowed to moderate globally';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Not allowed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.server_update_report_status(
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000401',
      'invalid','invalid status');
    RAISE EXCEPTION 'Invalid report status accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Invalid report status' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.notifications) <> 0 THEN
    RAISE EXCEPTION 'Rejected moderation produced notifications';
  END IF;

  PERFORM public.server_update_report_status(
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000401','resolved','Comprobación resuelta');
  IF (SELECT status FROM public.agreements
        WHERE id='00000000-0000-4000-8000-000000000301') <> 'disputed' THEN
     RAISE EXCEPTION 'Agreement must remain disputed while second report is active';
  END IF;
  IF (SELECT resolved_by FROM public.reports
        WHERE id='00000000-0000-4000-8000-000000000401') <>
     '00000000-0000-4000-8000-000000000102'::uuid OR
     (SELECT status FROM public.reports
        WHERE id='00000000-0000-4000-8000-000000000401') <> 'resolved' OR
     (SELECT count(*) FROM public.notifications
        WHERE user_id='00000000-0000-4000-8000-000000000501'
        AND kind='moderation_report_resolved') <> 1 THEN
     RAISE EXCEPTION 'Resolved report did not notify the correct reporter';
  END IF;

  PERFORM public.server_update_report_status(
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000402','dismissed','Segunda incidencia descartada');
  IF (SELECT status FROM public.agreements
        WHERE id='00000000-0000-4000-8000-000000000301') <> 'confirmed' OR
     (SELECT count(*) FROM public.notifications WHERE
        user_id='00000000-0000-4000-8000-000000000502'
        AND title='Incidencia descartada') <> 1 THEN
     RAISE EXCEPTION 'Closing all reports did not restore agreement and notify';
  END IF;

  PERFORM public.server_update_report_status(
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000403','resolved','Otra compra revisada');
  IF (SELECT status FROM public.agreements
        WHERE id='00000000-0000-4000-8000-000000000302') <> 'confirmed' OR
     (SELECT count(*) FROM public.notifications) <> 3 OR
     (SELECT count(*) FROM public.agreement_events) <> 3 THEN
    RAISE EXCEPTION 'Case status, notifications or audit events are inconsistent';
  END IF;
END $test$;
SQL

# A note-only save, a duplicate POST, or a retry after slow networking must
# not notify again or create a second incident audit event.
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
DO $test$
DECLARE
  v_original_resolved_at timestamptz;
  v_original_resolved_by uuid;
BEGIN
  select resolved_at, resolved_by
    into v_original_resolved_at, v_original_resolved_by
  from public.reports
  where id='00000000-0000-4000-8000-000000000403';
  PERFORM public.server_update_report_status(
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000403',
    'resolved','Otra compra revisada');
  IF (SELECT count(*) FROM public.notifications)<>3 OR
     (SELECT count(*) FROM public.agreement_events)<>3 THEN
    RAISE EXCEPTION 'Idempotent duplicate moderation POST created notifications/events';
  END IF;

  PERFORM public.server_update_report_status(
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000403',
    'resolved','Respuesta editada sin duplicado');
  IF (SELECT count(*) FROM public.notifications)<>3 OR
     (SELECT count(*) FROM public.agreement_events)<>3 OR
     (SELECT resolution_note FROM public.reports
       WHERE id='00000000-0000-4000-8000-000000000403')<>'Respuesta editada sin duplicado' OR
     (SELECT resolved_at FROM public.reports
       WHERE id='00000000-0000-4000-8000-000000000403') IS DISTINCT FROM v_original_resolved_at OR
     (SELECT resolved_by FROM public.reports
       WHERE id='00000000-0000-4000-8000-000000000403') IS DISTINCT FROM v_original_resolved_by THEN
    RAISE EXCEPTION 'Note-only moderation update changed resolution identity or created duplicates';
  END IF;

  -- Actual reopened-and-resolved status transitions legitimately produce
  -- one audit entry per transition and one NEW resolution notification.
  PERFORM public.server_update_report_status(
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000403','reviewing',null);
  IF (SELECT count(*) FROM public.notifications)<>3 OR
     (SELECT count(*) FROM public.agreement_events)<>4 OR
     (SELECT status FROM public.agreements
       WHERE id='00000000-0000-4000-8000-000000000302')<>'disputed' THEN
    RAISE EXCEPTION 'Reopening a closed report failed';
  END IF;
  PERFORM public.server_update_report_status(
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000403',
    'resolved','Segunda resolución tras reapertura');
  IF (SELECT count(*) FROM public.notifications)<>4 OR
     (SELECT count(*) FROM public.agreement_events)<>5 OR
     (SELECT status FROM public.agreements
       WHERE id='00000000-0000-4000-8000-000000000302')<>'confirmed' THEN
    RAISE EXCEPTION 'Legitimate re-resolution failed to notify once';
  END IF;
END $test$;
SQL
echo "Isolated moderation resolution PASS: non-super denied; idempotent same-state retries and note edits; one notification per transition."
