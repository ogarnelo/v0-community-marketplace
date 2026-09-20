import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260920172000_commerce_grants_hardening.sql",
  "utf8"
);

test("legacy commerce grants follow least privilege", () => {
  for (const table of [
    "payment_intents",
    "payment_events",
    "shipments",
    "shipment_events",
    "transaction_issues",
  ]) {
    assert.ok(migration.includes(`revoke all on table public.${table} from anon`));
  }

  for (const table of [
    "payment_intents",
    "payment_events",
    "shipments",
    "shipment_events",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke insert, update, delete, truncate, references, trigger[\\s\\S]*public\\.${table} from authenticated`
      )
    );
  }

  assert.match(
    migration,
    /revoke delete, truncate, references, trigger[\s\S]*public\.transaction_issues from authenticated/
  );
});
