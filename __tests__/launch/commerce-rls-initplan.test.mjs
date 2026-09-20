import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260920171000_commerce_rls_initplan.sql",
  "utf8"
);

test("commerce and transaction issue RLS cache auth.uid per statement", () => {
  for (const policy of [
    "payment_intents_select_owner",
    "payment_events_select_owner",
    "shipments_select_owner",
    "shipment_events_select_owner",
    "Participants can read transaction issues",
    "Participants can create transaction issues",
    "Issue opener can update own open issue",
  ]) {
    assert.ok(migration.includes(policy));
  }

  assert.ok(migration.includes("(select auth.uid())"));
  assert.doesNotMatch(migration, /(?<!select )auth\.uid\(\)/);
});
