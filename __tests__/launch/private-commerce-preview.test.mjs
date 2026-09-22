import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const access = readFileSync("lib/commerce/private-access.ts", "utf8");
const checkout = readFileSync("app/checkout/[offerId]/page.tsx", "utf8");
const stripeAction = readFileSync("app/actions/stripe.ts", "utf8");
const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
const label = readFileSync("app/api/shipments/create-label/route.ts", "utf8");
const dispatch = readFileSync("app/api/shipments/mark-dispatched/route.ts", "utf8");
const shipmentCard = readFileSync("components/shipments/shipment-status-card.tsx", "utf8");
const transactionStatus = readFileSync("components/messages/conversation-transaction-status.tsx", "utf8");
const lab = readFileSync("app/admin/super/commerce-lab/page.tsx", "utf8");
const simulate = readFileSync("app/api/admin/commerce-lab/simulate-label/route.ts", "utf8");
const docs = readFileSync("docs/PRIVATE_COMMERCE_PREVIEW_V2.md", "utf8");

test("private commerce requires explicit preview and authorized users", () => {
  assert.match(access, /ENABLE_PRIVATE_COMMERCE_PREVIEW/);
  assert.match(access, /PRIVATE_COMMERCE_TESTER_EMAILS/);
  assert.match(access, /super_admin/);
  assert.match(checkout, /canUserUseCommerce/);
  assert.match(stripeAction, /canUserUseCommerce/);
});

test("private Stripe preview fails closed on live keys and live webhooks", () => {
  assert.match(access, /sk_test_/);
  assert.match(access, /pk_test_/);
  assert.match(stripeAction, /assertStripeTestMode/);
  assert.match(webhook, /event\.livemode/);
  assert.match(webhook, /Live Stripe events are blocked/);
});

test("Sendcloud label creation stays behind a second explicit gate", () => {
  assert.match(access, /ENABLE_PRIVATE_COMMERCE_SENDCLOUD_LABELS/);
  assert.match(label, /isPrivateShippingLabelCreationEnabled/);
  assert.match(label, /creación real de etiquetas está bloqueada/);
});

test("commerce lab is admin-only and provides cost-free label simulation", () => {
  assert.match(lab, /Commerce Lab/);
  assert.match(lab, /super_admin/);
  assert.match(simulate, /sandbox_label_ready/);
  assert.match(simulate, /payment\.status !== "succeeded"/);
  assert.match(simulate, /status: "label_ready"/);
  assert.match(simulate, /provider: "sandbox"/);
});

test("shipping state UI and API follow the canonical state machine", () => {
  assert.match(dispatch, /shipment\.status !== "label_ready"/);
  assert.match(dispatch, /parsedTrackingUrl\.protocol !== "https:"/);
  assert.match(dispatch, /\.eq\("status", "label_ready"\)/);
  assert.match(shipmentCard, /Marcar como enviado/);
  assert.match(shipmentCard, /Confirmar entrega/);
});

test("payment UI uses succeeded, matching persisted payment state", () => {
  assert.match(transactionStatus, /payment\?\.status === "succeeded"/);
  assert.doesNotMatch(transactionStatus, /payment\?\.status === "paid"/);
});

test("preview docs keep public commerce off and choose delayed transfer architecture", () => {
  assert.match(docs, /ENABLE_LEGACY_COMMERCE=false/);
  assert.match(docs, /separate charges and transfers/);
  assert.match(docs, /No se implementa payout real/);
  assert.match(docs, /API v3/);
});
