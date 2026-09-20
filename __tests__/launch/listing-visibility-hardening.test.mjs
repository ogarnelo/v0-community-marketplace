import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("non-available listings are not public but remain visible to owners/participants", () => {
  const migration = read("supabase/migrations/20260920113000_listing_visibility_hardening.sql");
  const page = read("app/marketplace/listing/[id]/page.tsx");

  assert.match(migration, /to public[\s\S]*status = 'available'/);
  assert.match(migration, /to authenticated[\s\S]*auth\.uid\(\)[\s\S]*seller_id/);
  assert.match(migration, /public\.conversations/);

  assert.match(page, /listing\.status !== "available"/);
  assert.match(page, /Anuncio no disponible \| Wetudy/);
  assert.match(page, /participantConversation/);
  assert.match(page, /if \(!participantConversation\) notFound\(\)/);
});
