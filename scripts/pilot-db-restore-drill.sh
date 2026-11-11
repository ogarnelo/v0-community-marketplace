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

python3 scripts/pilot-local-restore-target-check.py

repo_root="$(pwd)"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
cd "$workdir"

# Retrieve the latest unexpired encrypted artifact from this same repository.
# No privileged production DB URL is required for the restore rehearsal.
gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=wetudy-encrypted-postgres-backup&per_page=100" > backup-artifacts.json
gh api "repos/$GITHUB_REPOSITORY/actions/workflows/wetudy-encrypted-db-backup.yml/runs?per_page=100" > backup-runs.json
artifact_id="$(python3 "$repo_root/scripts/pilot-select-trusted-backup-artifact.py" backup-artifacts.json backup-runs.json)"
test -n "$artifact_id" || {
  echo "No unexpired encrypted PostgreSQL backup artifact found. Create a new backup first." >&2
  exit 1
}
echo "Using existing encrypted backup artifact #$artifact_id"
gh api -H "Accept: application/vnd.github+json" \
  "repos/$GITHUB_REPOSITORY/actions/artifacts/$artifact_id/zip" > artifact.zip
python3 "$repo_root/scripts/pilot-safe-encrypted-backup-zip.py" artifact.zip backup

# The SHA256SUMS file is created by the existing backup workflow. Its expected
# path is relative to the workflow runner's root 'backup/' directory.
test -s backup/wetudy.dump.enc
test -s backup/SHA256SUMS.txt
sha256sum -c backup/SHA256SUMS.txt > /dev/null

# Backward-compatible with the previous seven-day archives, which were made
# with pg_dump --no-acl and lacked a separate privilege snapshot. Newer
# archives must validate their encrypted ACL envelope before claiming it exists.
acl_snapshot_verified=false
if [[ -s backup/wetudy-acl-snapshot.json.enc ]]; then
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -in backup/wetudy-acl-snapshot.json.enc \
    -out wetudy-acl-restore.json \
    -pass env:BACKUP_ENCRYPTION_PASSWORD
  python3 "$repo_root/scripts/pilot-backup-acl-snapshot-validate.py" \
    wetudy-acl-restore.json > /dev/null
  acl_snapshot_verified=true
  echo "Validated encrypted ACL metadata for 11 tables, 176 grants; NO grant replay."
else
  echo "LEGACY ARCHIVE: ACL evidence unavailable; this backup cannot reconstruct grants."
fi

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in backup/wetudy.dump.enc -out wetudy-restore.dump \
  -pass env:BACKUP_ENCRYPTION_PASSWORD
pg_restore --list wetudy-restore.dump > wetudy-restore.toc
python3 "$repo_root/scripts/pilot-db-backup-critical-toc.py" wetudy-restore.toc
# Metadata-only report on managed schemas; legacy archives may lack these
# sections. Informational until full Auth/Storage recovery is authorized.
python3 "$repo_root/scripts/pilot-managed-schema-toc-coverage.py" wetudy-restore.toc
# Report how many RLS POLICY definitions occur in the same encrypted backup.
# This is TOC metadata only, NOT a deployed-policy or runtime-RLS test.
python3 "$repo_root/scripts/pilot-backup-rls-policy-toc-audit.py" wetudy-restore.toc
# Restore ONLY two actual archived RLS POLICY definitions in a NEW disposable
# local PG17 database, with entirely synthetic owner/other-family test rows.
python3 "$repo_root/scripts/pilot-real-policy-restore-drill.py" wetudy-restore.dump wetudy-restore.toc

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
  printf "acl_snapshot_verified=%s\n" "$acl_snapshot_verified" >> "$GITHUB_OUTPUT"
fi
echo "This does NOT certify restore of Auth, chat, listings, transactions or Storage binaries."
