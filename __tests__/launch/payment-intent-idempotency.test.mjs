import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const buy=readFileSync("app/api/offers/buy-now/route.ts","utf8");
const prepare=readFileSync("app/api/payments/create-intent/route.ts","utf8");
const sql=readFileSync("scripts/pilot-payment-intent-partial-unique-regression.sql","utf8");
const ci=readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
for(const [name,source] of [["buy-now",buy],["create-intent",prepare]]){
 test(name+" never overwrites an existing payment intent on retry",()=>{
  assert.match(source,/\.from\("payment_intents"\)\s*\.insert\(/);
  assert.doesNotMatch(source,/\.from\("payment_intents"\)\s*\.upsert\(/);
  assert.doesNotMatch(source,/onConflict:\s*"offer_id"/);
  assert.match(source,/\.code === "23505"/);
  assert.match(source,/\.from\("payment_intents"\)\s*\.select\("id, status"\)\s*\.eq\("offer_id"/);
  assert.match(source,/status: 409/);
 });
}
test("local PG17 reproduces partial index conflict and verifies paid state untouched",()=>{
 assert.match(sql,/CREATE UNIQUE INDEX/);
 assert.match(sql,/WHERE offer_id IS NOT NULL/);
 assert.match(sql,/ON CONFLICT\(offer_id\) DO UPDATE/);
 assert.match(sql,/EXCEPTION WHEN invalid_column_reference/);
 assert.match(sql,/EXCEPTION WHEN unique_violation/);
 assert.match(sql,/status FROM qa_payment_intents WHERE offer_id=501/);
 assert.match(ci,/pilot-payment-intent-partial-unique-regression\.sql/);
});

const service=readFileSync("lib/services/payments.service.ts","utf8");
const stripe=readFileSync("app/actions/stripe.ts","utf8");
test("shared service inserts new drafts and rejects duplicate completed payments",()=>{
 assert.match(service,/\.from\("payment_intents"\)\s*\.insert\(/);
 assert.doesNotMatch(service,/\.from\("payment_intents"\)\s*\.upsert\(/);
 assert.match(service,/error\?\.code === "23505"/);
});
test("Stripe checkout cannot reset a finalized payment",()=>{
 assert.match(stripe,/existingPayment\.status !== 'requires_payment_method'/);
 assert.match(stripe,/\.from\('payment_intents'\)\s*\.update\(pendingUpdate\)/);
 assert.match(stripe,/\.eq\('status', 'requires_payment_method'\)/);
 assert.match(stripe,/\.from\('payment_intents'\)\s*\.insert\(paymentPayload\)/);
 assert.doesNotMatch(stripe,/\.from\('payment_intents'\)\s*\.upsert\(/);
 assert.doesNotMatch(stripe,/onConflict:\s*['"]offer_id['"]/);
 assert.match(stripe,/!registeredPayment/);
});
test("all four payment entry points are protected",()=>{
 for(const [name,src] of [["buy",buy],["create",prepare],["service",service],["stripe",stripe]])
   assert.doesNotMatch(src,/\.from\(["']payment_intents["']\)\s*\.upsert\(/,name);
 assert.match(sql,/GET DIAGNOSTICS changed_rows = ROW_COUNT/);
});
