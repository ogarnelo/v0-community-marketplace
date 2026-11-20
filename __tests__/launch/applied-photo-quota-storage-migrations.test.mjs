import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const photoQuota = readFileSync(
  "supabase/migrations/20261119165430_p0_photo_upload_claim_quota_20261119.sql", "utf8"
);
const storage = readFileSync(
  "supabase/migrations/20261119194748_p0_photo_server_only_storage_policies_20261119.sql", "utf8"
);

test("both historical production migrations are complete, transactional and versioned", () => {
  for (const sql of [photoQuota, storage]) {
    assert.match(sql, /^BEGIN;/);
    assert.match(sql, /COMMIT;\s*$/);
    assert.match(sql, /SET LOCAL lock_timeout\s*=\s*'5s'/);
    assert.match(sql, /SET LOCAL statement_timeout\s*=\s*'30s'/);
  }
});

test("quota migration blocks browser clients and serializes concurrent uploads", () => {
  assert.match(photoQuota, /CREATE TABLE IF NOT EXISTS public\.photo_upload_claims/);
  assert.match(photoQuota, /ALTER TABLE public\.photo_upload_claims ENABLE ROW LEVEL SECURITY/);
  assert.match(photoQuota, /REVOKE ALL ON public\.photo_upload_claims FROM PUBLIC, anon, authenticated/);
  assert.match(photoQuota, /GRANT SELECT, INSERT ON public\.photo_upload_claims TO service_role/);
  assert.match(photoQuota, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(photoQuota, /recent_10_minutes >= 12 OR recent_24_hours >= 60/);
  assert.match(photoQuota, /LANGUAGE plpgsql SECURITY INVOKER/);
  assert.match(photoQuota, /REVOKE ALL ON FUNCTION public\.claim_photo_upload_slot\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(photoQuota, /GRANT EXECUTE ON FUNCTION public\.claim_photo_upload_slot\(uuid\)[\s\S]*TO service_role/);
});

test("Storage migration fail-closes on wrong original policies BEFORE changing grants", () => {
  assert.match(storage, /WETUDY_PHOTO_UNEXPECTED_LEGACY_POLICIES/);
  assert.match(storage, /WETUDY_PHOTO_UNEXPECTED_OTHER_INSERT_POLICIES/);
  assert.match(storage, /WETUDY_STORAGE_RLS_DISABLED/);
  assert.match(storage, /WETUDY_PHOTO_QUOTA_MISSING/);
  assert.match(storage, /WETUDY_CHAT_READ_POLICY_MISSING/);
  assert.match(storage, /DROP POLICY IF EXISTS "listing photo uploads stay in own user folder"/);
  assert.match(storage, /DROP POLICY IF EXISTS "conversation participants can upload own chat attachments"/);
  assert.match(storage, /CREATE POLICY "conversation participants may upload documents only"/);
  assert.match(storage, /bucket_id = 'chat-attachments'/);
  assert.match(storage, /lower\(storage\.extension\(name\)\) IN \('pdf','doc','docx'\)/);
  assert.match(storage, /conversation participants can read chat attachments/);
  assert.match(storage, /WETUDY_PHOTO_LEGACY_INSERT_REMAINS/);
  assert.match(storage, /WETUDY_PHOTO_UNEXPECTED_INSERT_COUNT/);
  assert.match(storage, /WETUDY_CHAT_READ_POLICY_LOST/);
});

test("recovery files neither open generic image upload nor weaken grants", () => {
  assert.doesNotMatch(storage, /CREATE POLICY[^;]+(?:listing photo uploads stay|can upload own chat attachments)/i);
  assert.doesNotMatch(storage, /GRANT\s+(?:ALL|INSERT)\s+ON\s+storage\.objects\s+TO\s+(?:anon|authenticated)/i);
  assert.doesNotMatch(storage, /DROP POLICY[^;]+can read chat attachments/i);
  assert.doesNotMatch(photoQuota, /GRANT EXECUTE ON FUNCTION[^;]+TO (?:PUBLIC|anon|authenticated)/i);
});
