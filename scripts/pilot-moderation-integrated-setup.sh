#!/usr/bin/env bash
# Never use against Supabase or a nonlocal database.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
python3 - <<'PY'
import os
from urllib.parse import urlsplit
url=urlsplit(os.environ["DATABASE_URL"])
if url.scheme not in ("postgres","postgresql") or url.hostname not in ("127.0.0.1","localhost","::1"):
    raise SystemExit("Refusing integrated moderation UI setup against nonlocal PostgreSQL")
PY
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/pilot-moderation-integrated-fixture.sql
function_script="$(mktemp)"
trap 'rm -f "$function_script"' EXIT
python3 - "$function_script" <<'PY'
from pathlib import Path
import sys
src=Path("supabase/migrations/20261108195500_report_status_idempotent_notifications.sql").read_text()
start=src.lower().find("create or replace function public.server_update_report_status(")
end=src.find("$$;",start)
if start<0 or end<0 or "p_resolution_note text" not in src[start:end]:
    raise SystemExit("Cannot extract real PR #267 four-argument moderation function")
Path(sys.argv[1]).write_text(src[start:end+3]+"\n")
PY
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$function_script"
echo "Loaded real PR #267 moderation SQL function into disposable localhost PG17."
