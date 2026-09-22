import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const migration = read("supabase/migrations/20260922094000_private_commerce_connect_v3.sql");
const access = read("lib/commerce/private-access.ts");
const connect = read("lib/commerce/connect.ts");
const connectRoute = read("app/api/commerce/connect/account/route.ts");
const connectRefresh = read("app/api/commerce/connect/onboarding/route.ts");
const connectPage = read("app/account/commerce-preview/page.tsx");
const release = read("app/api/admin/commerce-lab/release-transfer/route.ts");
const refund = read("app/api/admin/commerce-lab/refund/route.ts");
const lab = read("app/admin/super/commerce-lab/page.tsx");
const stripeCheckout = read("app/actions/stripe.ts");
const stripeWebhook = read("app/api/stripe/webhook/route.ts");

test("Connect preview stays behind private commerce and Stripe test mode", () => {
  assert.match(access, /ENABLE_PRIVATE_COMMERCE_PREVIEW/);
  assert.match(access, /sk_test_/);
  assert.match(connectRoute, /canUserAccessPrivateCommercePreview/);
  assert.match(connectRoute, /assertStripeTestMode/);
  assert.match(connectRefresh, /canUserAccessPrivateCommercePreview/);
  assert.match(connectPage, /canUserAccessPrivateCommercePreview/);
  assert.doesNotMatch(connectRoute, /canUserUseCommerce/);
  assert.doesNotMatch(connectRefresh, /canUserUseCommerce/);
  assert.doesNotMatch(connectPage, /canUserUseCommerce/);
});

test("seller connected account creation is explicit and idempotent", () => {
  assert.match(connect, /getAccountsApi\(\)\.create/);
  assert.match(connect, /type: "express"/);
  assert.match(connect, /transfers: \{ requested: true \}/);
  assert.match(connect, /wetudy-connect-account-v1/);
  assert.match(connectRoute, /if \(!existing\?\.stripe_account_id\)/);
  assert.match(connectRoute, /account: null/);
  assert.match(connectRoute, /accountLinks\.create/);
});

test("Connect and settlement tables use RLS and server-only writes", () => {
  for (const table of [
    "seller_connect_accounts",
    "commerce_transfers",
    "commerce_refunds",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon`));
    assert.match(migration, new RegExp(`grant all on table public\\.${table} to service_role`));
  }
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /seller_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /buyer_id = \(select auth\.uid\(\)\)/);
});

test("test transfer release requires paid state, delivery and ready Connect seller", () => {
  assert.match(release, /payment\.status !== "succeeded"/);
  assert.match(release, /shipment\.status !== "delivered"/);
  assert.match(release, /connectStatus\.transfersActive/);
  assert.match(release, /connectStatus\.payoutsEnabled/);
  assert.match(release, /source_transaction: chargeId/);
  assert.match(release, /paymentIntent\.amount_received/);
  assert.match(release, /stripe\.transfers\.list/);
  assert.match(release, /amount_reversed > 0/);
  assert.match(release, /reconciled_from_stripe/);
  assert.match(release, /wetudy-transfer-v1/);
  assert.match(release, /sandbox_transfer_released/);
});

test("test refund reverses released transfer before refunding Stripe payment", () => {
  const reversalIndex = refund.indexOf("stripe.transfers.createReversal");
  const refundIndex = refund.indexOf("stripe.refunds.create");
  assert.ok(reversalIndex >= 0);
  assert.ok(refundIndex > reversalIndex);
  assert.match(refund, /wetudy-transfer-reversal-v1/);
  assert.match(refund, /stripe\.refunds\.list/);
  assert.match(refund, /amount: expectedAmountCents/);
  assert.match(refund, /amount_reversed > 0/);
  assert.match(refund, /reconciled_from_stripe/);
  assert.match(refund, /wetudy-refund-v1/);
  assert.match(refund, /status: "refunded"/);
  assert.match(refund, /sandbox_refund_created/);
});

test("Commerce Lab exposes manual-only test settlement controls", () => {
  assert.match(lab, /Vendedores Connect test/);
  assert.match(lab, /Transferencias test/);
  assert.match(lab, /Refunds test/);
  assert.match(lab, /Eventos y errores/);
  assert.match(lab, /payment_events/);
  assert.match(lab, /error_code/);
  assert.match(lab, /ReleaseTransferButton/);
  assert.match(lab, /RefundPaymentButton/);
  assert.match(lab, /no existe payout automático ni activación pública/);
});



test("Connect account.updated stays private, test-only and synchronizes capabilities", () => {
  assert.match(stripeWebhook, /event\.type === "account\.updated"/);
  assert.match(stripeWebhook, /isPrivateCommercePreviewEnabled\(\)/);
  assert.match(stripeWebhook, /event\.livemode/);
  assert.match(stripeWebhook, /syncSellerConnectAccountSnapshot/);
  assert.match(connect, /disabled_reason/);
  assert.match(connect, /onboardingStatus: disabledReason/);
});

test("private Checkout keeps settlement deterministic", () => {
  assert.match(stripeCheckout, /payment_method_types: \['card'\]/);
  assert.match(stripeCheckout, /payment_intent_data/);
  assert.match(stripeCheckout, /transfer_group: \`wetudy_\$\{offerId\}\`/);
  assert.match(stripeCheckout, /wetudy_private_preview: 'true'/);
  assert.match(stripeCheckout, /paymentWriteError/);
  assert.match(stripeCheckout, /listingReserveError/);
  assert.match(stripeCheckout, /checkout\.sessions\.expire/);
  assert.match(stripeWebhook, /registeredSessionId/);
  assert.match(stripeWebhook, /registeredSessionId !== session\.id/);
});
