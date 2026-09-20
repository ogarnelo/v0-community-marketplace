import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stripe = readFileSync("app/actions/stripe.ts", "utf8");
const threatModel = readFileSync("docs/PAYMENTS_SHIPPING_THREAT_MODEL_V1.md", "utf8");

test("Stripe Checkout creation is idempotent per accepted operation and delivery selection", () => {
  assert.match(stripe, /const checkoutIdempotencyKey = \[/);
  assert.match(stripe, /"wetudy-checkout-v1"/);
  assert.match(stripe, /offerId,/);
  assert.match(stripe, /deliveryMethod,/);
  assert.match(stripe, /shipmentTier,/);
  assert.match(stripe, /idempotencyKey: checkoutIdempotencyKey/);
});

test("commerce threat model records Checkout idempotency as implemented", () => {
  assert.match(
    threatModel,
    /- \[x\] Idempotency key en creación de Stripe Checkout Session\./
  );
});
