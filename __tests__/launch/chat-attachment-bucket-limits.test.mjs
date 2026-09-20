import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260920121500_chat_attachment_bucket_limits.sql",
  "utf8"
);
const form = readFileSync("components/messages/send-message-form.tsx", "utf8");

test("chat attachment bucket mirrors client size and MIME restrictions", () => {
  assert.match(migration, /file_size_limit = 10485760/);

  const mimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  for (const mime of mimeTypes) {
    assert.ok(migration.includes(mime), `migration should allow ${mime}`);
    assert.ok(form.includes(mime), `client should allow ${mime}`);
  }

  assert.match(form, /MAX_FILE_SIZE = 10 \* 1024 \* 1024/);
});
