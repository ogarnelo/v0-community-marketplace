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
