import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const workflow = read(".github/workflows/pilot-combined-encrypted-recovery.yml");
const script = read("scripts/pilot-storage-offline-recovery.sh");
const verifier = read("scripts/verify-pilot-storage-restore.py");

test("combined recovery works only on disposable local PostgreSQL and encrypted GitHub artifacts", () => {
  assert.match(workflow, /postgres:17/);
  assert.match(workflow, /LOCAL_RESTORE_URL: postgresql:\/\/wetudy_restore:[^@]+@127\.0\.0\.1/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /WETUDY_BACKUP_ENCRYPTION_PASSWORD/);
  assert.match(workflow, /scripts\/pilot-db-restore-drill\.sh/);
  assert.match(workflow, /scripts\/pilot-storage-offline-recovery\.sh/);
  assert.match(workflow, /test_pilot_storage_restore\.py/);
  assert.doesNotMatch(workflow, /WETUDY_STORAGE_BACKUP_SERVICE_ROLE_KEY|WETUDY_BACKUP_DATABASE_URL/);
});

test("storage source artifact is hashed and decrypted without writing back to Supabase", () => {
  assert.match(script, /wetudy-encrypted-storage-backup/);
  assert.match(script, /sha256sum -c backup\/STORAGE_SHA256SUMS\.txt/);
  assert.match(script, /openssl enc -d -aes-256-cbc -pbkdf2/);
  assert.match(script, /trap 'rm -rf "\$workdir"' EXIT/);
  assert.match(script, /verify-pilot-storage-restore\.py/);
  assert.doesNotMatch(script, /supabase\.co|service.role|storage\.upload|curl.*storage\/v1/);
});

test("offline restore reconstructs only whitelisted bucket objects and verifies SHA256", () => {
  assert.match(verifier, /BUCKETS = \{"listing-photos", "chat-attachments"\}/);
  assert.match(verifier, /TemporaryDirectory/);
  assert.match(verifier, /not member\.isfile\(\) or member\.issym\(\) or member\.islnk\(\)/);
  assert.match(verifier, /Restored file hash mismatch/);
  assert.match(verifier, /set\(members\) != expected_paths/);
  assert.match(verifier, /MAX_TOTAL_BYTES/);
});
