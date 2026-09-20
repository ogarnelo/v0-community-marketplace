import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260920173500_stripe_webhook_idempotency.sql",
  "utf8"
);

test("Stripe webhook verifies signatures and handles Checkout lifecycle events", () => {
  assert.match(webhook, /stripe\.webhooks\.constructEvent/);
  assert.match(webhook, /checkout\.session\.completed/);
  assert.match(webhook, /checkout\.session\.async_payment_succeeded/);
  assert.match(webhook, /checkout\.session\.async_payment_failed/);
  assert.match(webhook, /missing_checkout_metadata/);
  assert.match(webhook, /payment_intent_not_found/);
  assert.match(webhook, /Stripe checkout total does not match the payment intent/);
});

test("Stripe webhook is idempotent and never downgrades succeeded payments", () => {
  assert.match(webhook, /provider_event_id: event\.id/);
  assert.match(webhook, /eventInsertError\.code !== "23505"/);
  assert.match(webhook, /paymentUpdate = paymentUpdate\.neq\("status", "succeeded"\)/);
  assert.match(webhook, /\.in\("status", \["available", "reserved"\]\)/);
  assert.match(migration, /create unique index if not exists payment_events_provider_event_id_unique_idx/);
  assert.match(migration, /where provider_event_id is not null/);
});
