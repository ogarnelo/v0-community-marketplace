import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const action=readFileSync("app/actions/stripe.ts","utf8");
const part=action.slice(action.indexOf("export async function confirmPaymentComplete("),
  action.indexOf("export async function checkSessionStatus("));
const webhook=readFileSync("app/api/stripe/webhook/route.ts","utf8");
test("fallback allows only pending statuses, not refunded/cancelled/succeeded",()=>{
 assert.match(part,/const pendingStates = \['requires_payment_method', 'requires_confirmation', 'requires_capture', 'processing'\]/);
 assert.match(part,/if \(!pendingStates\.includes\(paymentIntent\.status\)\)/);
 assert.match(webhook,/paymentIntent\.status === "refunded"/);
 assert.match(webhook,/paymentIntent\.status === "cancelled"/);
});
test("fallback verifies the same Stripe session, actors, listing and price",()=>{
 assert.match(part,/session\.id !== sessionId/);
 assert.match(part,/session\.metadata\?\.listing_id !== paymentIntent\.listing_id/);
 assert.match(part,/session\.metadata\?\.seller_id !== paymentIntent\.seller_id/);
 assert.match(part,/!Number\.isFinite\(expectedTotal\)/);
 assert.match(part,/session\.amount_total !== Math\.round\(expectedTotal \* 100\)/);
});
test("fallback uses CAS and confirms exactly one row BEFORE modifying offer/listing",()=>{
 assert.match(part,/\.eq\('status', paymentIntent\.status\)\s*\.select\('id'\)\s*\.maybeSingle\(\)/);
 const guard=part.indexOf("if (paymentUpdateError || !confirmedPayment)");
 const offer=part.indexOf(".from('listing_offers')");
 const listing=part.indexOf(".from('listings')");
 assert.ok(guard>0 && guard<offer && guard<listing);
});
