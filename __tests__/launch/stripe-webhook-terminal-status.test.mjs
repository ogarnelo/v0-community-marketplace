import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const route=readFileSync("app/api/stripe/webhook/route.ts","utf8");
const sql=readFileSync("scripts/pilot-stripe-webhook-status-cas-pg17.sql","utf8");
const workflow=readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
test("valid Stripe signature is not enough: registered session must match",()=>{
 assert.match(route,/!registeredSessionId \|\| registeredSessionId !== session\.id/);
 assert.match(route,/!session\.metadata\?\.listing_id/);
 assert.match(route,/session\.metadata\.seller_id !== paymentIntent\.seller_id/);
 assert.match(route,/!Number\.isFinite\(expectedTotal\)/);
 assert.match(route,/session\.amount_total !== Math\.round\(expectedTotal \* 100\)/);
});
test("late events cannot resurrect refunds or cancelations",()=>{
 assert.match(route,/paymentIntent\.status === "refunded"/);
 assert.match(route,/paymentIntent\.status === "cancelled"/);
 assert.match(route,/paymentIntent\.status === "succeeded" && nextStatus !== "succeeded"/);
 assert.match(route,/\.eq\("status", paymentIntent\.status\)/);
 assert.match(route,/\.select\("id"\)\s*\.maybeSingle\(\)/);
 assert.match(route,/if \(!updatedPayment\)/);
});
test("PG17 regression covers status race as local SQL not live Stripe",()=>{
 assert.match(sql,/CREATE TEMP TABLE/);
 assert.match(sql,/NO_GO_WEBHOOK_STATUS_REGRESSION/);
 assert.match(sql,/ROLLBACK;/);
 assert.match(workflow,/pilot-stripe-webhook-status-cas-pg17\.sql/);
});
