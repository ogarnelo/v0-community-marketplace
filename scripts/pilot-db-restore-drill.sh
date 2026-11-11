#!/usr/bin/env bash
# Restore a harmless, non-personal national-school directory subset of a
# *previously encrypted* Wetudy PostgreSQL backup into disposable local PG17.
# This is not a full-DB/Storage restore. It never connects to production SQL.
set -euo pipefail
umask 077

: "${GITHUB_REPOSITORY:?}"
: "${GH_TOKEN:?}"
: "${BACKUP_ENCRYPTION_PASSWORD:?}"
: "${LOCAL_RESTORE_URL:?}"

python3 - <<'PY'
from urllib.parse import urlsplit
import os
url = urlsplit(os.environ["LOCAL_RESTORE_URL"])
if url.scheme not in ("postgresql", "postgres") or url.hostname not in ("127.0.0.1", "localhost", "::1"):
    raise SystemExit("Refusing to restore to a nonlocal Postgres server")
PY

repo_root="$(pwd)"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
cd "$workdir"

# Retrieve the latest unexpired encrypted artifact from this same repository.
# No privileged production DB URL is required for the restore rehearsal.
artifact_id="$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=wetudy-encrypted-postgres-backup&per_page=100" \
  --jq '[.artifacts[] | select(.expired == false)] | sort_by(.created_at) | last | .id // empty')"
test -n "$artifact_id" || {
  echo "No unexpired encrypted PostgreSQL backup artifact found. Create a new backup first." >&2
  exit 1
}
echo "Using existing encrypted backup artifact #$artifact_id"
gh api -H "Accept: application/vnd.github+json" \
  "repos/$GITHUB_REPOSITORY/actions/artifacts/$artifact_id/zip" > artifact.zip
unzip -tq artifact.zip > /dev/null
mkdir -m 700 backup
unzip -qq artifact.zip -d backup

# The SHA256SUMS file is created by the existing backup workflow. Its expected
# path is relative to the workflow runner's root 'backup/' directory.
test -s backup/wetudy.dump.enc
test -s backup/SHA256SUMS.txt
sha256sum -c backup/SHA256SUMS.txt > /dev/null

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in backup/wetudy.dump.enc -out wetudy-restore.dump \
  -pass env:BACKUP_ENCRYPTION_PASSWORD
pg_restore --list wetudy-restore.dump > wetudy-restore.toc
python3 "$repo_root/scripts/pilot-db-backup-critical-toc.py" wetudy-restore.toc

# Only restore the public national-school directory into the ephemeral PG17.
# This table has no user credentials, messages or school membership data.
# The rest of the backup, including user PII, is never sent to the database.
pg_restore --exit-on-error --no-owner --no-acl \
  --table=school_directory --section=pre-data \
  --dbname="$LOCAL_RESTORE_URL" wetudy-restore.dump
pg_restore --exit-on-error --no-owner --no-acl \
  --table=school_directory --data-only \
  --dbname="$LOCAL_RESTORE_URL" wetudy-restore.dump

count="$(psql -X -A -t "$LOCAL_RESTORE_URL" -c 'select count(*) from public.school_directory;')"
test "$count" -ge 30000 || {
  echo "Directory restore contains too few rows" >&2
  exit 1
}
school_count="$(psql -X -A -t "$LOCAL_RESTORE_URL" \
  -c "select count(*) from public.school_directory where official_code='04602365' and name ilike '%Alborán%';")"
test "$school_count" -eq 1 || {
  echo "Expected national-school record was not recovered" >&2
  exit 1
}
unsafe_count="$(psql -X -A -t "$LOCAL_RESTORE_URL" \
  -c 'select count(*) from public.school_directory where is_listed or seo_indexable or linked_school_id is not null;')"
test "$unsafe_count" -eq 0 || {
  echo "Restored source had active national-school links; review before proceeding" >&2
  exit 1
}
echo "Partial PostgreSQL restore PASS: $count national-school records; 0 active school links."
# Only a GitHub Actions output: consumed by the final proof step after Storage passes.
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf "backup_artifact_id=%s\n" "$artifact_id" >> "$GITHUB_OUTPUT"
fi
echo "This does NOT certify restore of Auth, chat, listings, transactions or Storage binaries."
