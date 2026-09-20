import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260920114500_chat_attachment_privacy_hardening.sql",
  "utf8"
);

test("chat attachments are scoped to conversation participants and uploader folders", () => {
  assert.match(migration, /bucket_id = 'chat-attachments'/);
  assert.match(migration, /public\.conversations/);
  assert.match(migration, /c\.buyer_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /c\.seller_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /\(storage\.foldername\(name\)\)\[2\] = \(select auth\.uid\(\)\)::text/);
  assert.doesNotMatch(migration, /create policy "authenticated users can (?:read|update|delete) chat attachments"/);
});
