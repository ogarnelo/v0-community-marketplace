import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260922090000_private_connect_preview.sql", "utf8");
const connect = readFileSync("lib/commerce/stripe-connect-v2.ts", "utf8");\nconst transfers = readFileSync("lib/commerce/stripe-transfers.ts", "utf8");
const onboarding = readFileSync("app/api/commerce/connect/onboarding/route.ts", "utf8");
const sync = readFileSync("app/api/commerce/connect/sync/route.ts", "utf8");
const release = readFileSync("app/api/admin/commerce-lab/release-transfer/route.ts", "utf8");
const account = readFileSync("app/account/commerce/page.tsx", "utf8");
const lab = readFileSync("app/admin/super/commerce-lab/page.tsx", "utf8");
const docs = readFileSync("docs/PRIVATE_COMMERCE_PREVIEW_V2.md", "utf8");

test("connected accounts store only minimal recipient state behind RLS", () => {
  assert.match(migration, /commerce_connected_accounts/);
  assert.match(migration, /configuration text not null default 'recipient'/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /public\.is_superadmin\(\)/);
  assert.doesNotMatch(migration, /date_of_birth|document_number|identity_document|bank_account/i);
});

test("Stripe Connect uses Accounts v2 recipient onboarding in test mode", () => {
  assert.match(connect, /STRIPE_V2_BASE/);
  assert.match(connect, /recipient/);\n  assert.match(connect, /2026-07-29\.preview/);
  assert.match(connect, /stripe_transfers/);
  assert.match(connect, /account_links/);
  assert.match(connect, /assertStripeTestMode/);
  assert.match(onboarding, /canUserAccessPrivateCommercePreview/);
  assert.match(sync, /getConnectedAccountSnapshot/);
});

test("seller transfer is separate, delayed and idempotent", () => {
  assert.match(migration, /commerce_transfers/);
  assert.match(migration, /payment_intent_id uuid not null unique/);
  assert.match(transfers, /stripe\.transfers\.create/);
  assert.match(transfers, /source_transaction/);
  assert.match(connect, /idempotencyKey: `wetudy-transfer-v1:/);
  assert.match(release, /payment\.status !== "succeeded"/);
  assert.match(release, /shipment\.status !== "delivered"/);
  assert.match(release, /connectedAccount\?\.transfers_enabled/);
  assert.match(release, /status: "releasing"/);
  assert.match(release, /status: "released"/);
});

test("Connect and transfer controls remain private", () => {
  assert.match(account, /canUserAccessPrivateCommercePreview/);
  assert.match(account, /preview privado/);
  assert.match(lab, /ReleaseTransferButton/);
  assert.match(lab, /Configurar mi cuenta Connect test/);
  assert.match(release, /super_admin/);
  assert.match(docs, /No existe liberación automática ni payout live/);
});

test("private docs keep public commerce blocked", () => {
  assert.match(docs, /separate charges and transfers/);
  assert.match(docs, /Refund\/reversal test/);
  assert.match(docs, /revisión jurídica\/fiscal/i);
});
