#!/usr/bin/env bash
# LOCAL ONLY: database-only restore drill with 60k synthetic family rows.
# This does not validate production backup, Supabase Auth or Storage blobs.
set -euo pipefail
: "${DATABASE_URL:?Provide localhost disposable PG17 URL}"
python3 - <<'PY'
import os
from urllib.parse import urlsplit
u=urlsplit(os.environ["DATABASE_URL"])
if u.scheme not in ("postgres","postgresql") or u.hostname not in ("127.0.0.1","localhost","::1"):
    raise SystemExit("Refusing to run backup/restore against remote database")
PY
backup="$(mktemp /tmp/wetudy-pilot-synthetic-XXXXXX.dump)"
manifest="$(mktemp /tmp/wetudy-pilot-synthetic-list-XXXXXX.txt)"
trap 'rm -f "$backup" "$manifest"' EXIT

# Original public schema includes the exact deployed member-count SQL function,
# synthetic school-member table data and its existing indexes.
pg_dump --format=custom --schema=public --no-owner --file="$backup" "$DATABASE_URL"
pg_restore --list "$backup" > "$manifest"
grep -q 'TABLE DATA public profiles' "$manifest"
grep -q 'TABLE DATA public account_students' "$manifest"
grep -q 'FUNCTION public server_school_member_count' "$manifest"
before="$(sha256sum "$backup" | cut -d' ' -f1)"

psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -c "CREATE DATABASE wetudy_synthetic_restore_qa;" >/dev/null
restore_url="$(python3 - <<'PY'
import os
from urllib.parse import urlsplit,urlunsplit
u=urlsplit(os.environ["DATABASE_URL"])
print(urlunsplit((u.scheme,u.netloc,"/wetudy_synthetic_restore_qa","","")))
PY
)"
pg_restore --clean --if-exists --no-owner --exit-on-error --dbname="$restore_url" "$backup" >/dev/null
after="$(sha256sum "$backup" | cut -d' ' -f1)"
test "$before" = "$after"

counts="$(psql -X -A -t -v ON_ERROR_STOP=1 "$restore_url" -c "select
  (select count(*) from public.profiles),
  (select count(*) from public.account_students),
  (select count(*) from public.user_roles),
  public.server_school_member_count('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
  has_function_privilege('anon','public.server_school_member_count(uuid)','EXECUTE'),
  has_function_privilege('authenticated','public.server_school_member_count(uuid)','EXECUTE'),
  has_function_privilege('service_role','public.server_school_member_count(uuid)','EXECUTE');")"
expected="60000|120000|3000|19764|f|f|t"
if [ "$counts" != "$expected" ]; then
  echo "FAIL: restored synthetic tables/function/roles mismatched expected $expected; got $counts" >&2
  exit 1
fi
printf 'PASS disposable PG17 synthetic PUBLIC schema restore: 60k profiles, 120k contexts, 3k roles, ALFA=19764, function ACL f|f|t. SHA-256 preserved.\n'
printf 'LIMIT: public-schema backup of ONLY synthetic PG fixture, NOT complete Supabase Auth, Storage file contents or production recovery.\n'
