import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260915204500_payment_shipping_sandbox.sql", "utf8");
const route = readFileSync("app/api/admin/sandbox/payment-shipping/route.ts", "utf8");
const planner = readFileSync("lib/sandbox/payment-shipping.ts", "utf8");
const docs = readFileSync("docs/PAYMENTS_SHIPPING_SANDBOX_V1.md", "utf8");

test("sandbox stores payment and shipping experiment runs for admins only", () => {
  assert.match(migration, /payment_shipping_sandbox_runs/);
  assert.match(migration, /stripe_connect/);
  assert.match(migration, /correos/);
  assert.match(migration, /public\.is_superadmin\(\)/);
  assert.match(route, /admin_required/);
});

test("sandbox planner covers Stripe Connect and shipping scenarios", () => {
  assert.match(planner, /stripe_connect_onboarding/);
  assert.match(planner, /protected_payment_hold/);
  assert.match(planner, /protected_payment_release/);
  assert.match(planner, /protected_payment_refund/);
  assert.match(planner, /correos_label_quote/);
  assert.match(planner, /shipping_aggregator_quote/);
});

test("sandbox remains non-user-visible", () => {
  assert.match(planner, /userVisible: false/);
  assert.match(docs, /No public checkout/);
  assert.match(docs, /No Apple Pay button/);
  assert.match(docs, /No Correos label creation/);
});
