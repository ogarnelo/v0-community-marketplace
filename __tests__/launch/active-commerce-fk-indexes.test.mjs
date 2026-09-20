import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260920123000_active_commerce_fk_indexes.sql",
  "utf8"
);

test("active and preserved commerce foreign keys have covering indexes", () => {
  for (const indexName of [
    "donation_request_events_actor_id_idx",
    "school_impact_report_deliveries_user_id_idx",
    "school_impact_report_subscriptions_user_id_idx",
    "payment_intents_conversation_id_idx",
    "payment_intents_school_id_idx",
    "shipments_conversation_id_idx",
    "shipments_payment_intent_id_idx",
    "payment_shipping_sandbox_runs_agreement_id_idx",
    "payment_shipping_sandbox_runs_created_by_idx",
    "payment_shipping_sandbox_runs_listing_id_idx",
  ]) {
    assert.ok(migration.includes(`create index if not exists ${indexName}`));
  }
});
