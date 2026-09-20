import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
const label = readFileSync("app/api/shipments/create-label/route.ts", "utf8");
const card = readFileSync("components/shipments/shipment-status-card.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260920175000_shipment_state_hardening.sql",
  "utf8"
);

test("paid shipping checkout creates exactly one draft shipment", () => {
  assert.match(webhook, /delivery_method === "shipping"/);
  assert.match(webhook, /\.eq\("payment_intent_id", paymentIntent\.id\)/);
  assert.match(webhook, /status: "draft"/);
  assert.match(webhook, /shipmentInsertError\.code !== "23505"/);
  assert.match(migration, /shipments_payment_intent_id_unique_idx/);
});

test("label creation requires a succeeded payment and valid shipment states", () => {
  assert.match(label, /payment\.status !== "succeeded"/);
  assert.match(label, /\["draft", "quoted", "label_pending"\]/);
  assert.match(label, /created\.labelUrl \? "label_ready" : "label_pending"/);
  assert.doesNotMatch(label, /label_created|ready_to_ship|manual_pending/);
});

test("shipment UI uses the canonical database state machine", () => {
  for (const status of [
    "draft",
    "quoted",
    "label_pending",
    "label_ready",
    "in_transit",
    "delivered",
    "failed",
    "cancelled",
  ]) {
    assert.ok(card.includes(`case "${status}"`));
  }
  assert.doesNotMatch(card, /label_created|ready_to_ship|manual_pending|dispatched/);
});
