#!/usr/bin/env bash
# Offline decryption/recovery verification of an existing encrypted Storage
# artifact. Never connects to Supabase production or uploads decrypted data.
set -euo pipefail
umask 077
: "${GITHUB_REPOSITORY:?}"
: "${GH_TOKEN:?}"
: "${BACKUP_ENCRYPTION_PASSWORD:?}"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
cd "$workdir"

artifact_id="$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=wetudy-encrypted-storage-backup&per_page=100" \
  --jq '[.artifacts[] | select(.expired == false)] | sort_by(.created_at) | last | .id // empty')"
test -n "$artifact_id" || {
  echo "Missing unexpired encrypted Storage backup artifact. Run the Storage backup again first." >&2
  exit 1
}
echo "Using existing encrypted Storage artifact #$artifact_id"

gh api -H "Accept: application/vnd.github+json" \
  "repos/$GITHUB_REPOSITORY/actions/artifacts/$artifact_id/zip" > encrypted-storage-artifact.zip
unzip -tq encrypted-storage-artifact.zip > /dev/null
mkdir -m 700 backup
unzip -qq encrypted-storage-artifact.zip -d backup

test -s backup/wetudy-storage.tar.gz.enc
test -s backup/STORAGE_SHA256SUMS.txt
sha256sum -c backup/STORAGE_SHA256SUMS.txt > /dev/null

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in backup/wetudy-storage.tar.gz.enc \
  -out recovered-storage.tar.gz \
  -pass env:BACKUP_ENCRYPTION_PASSWORD
python3 "$GITHUB_WORKSPACE/scripts/verify-pilot-storage-restore.py" recovered-storage.tar.gz

echo "Encrypted Storage backup successfully decrypted and recovered locally."
echo "This does NOT validate a full Supabase Storage or application restore."
