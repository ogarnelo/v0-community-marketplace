import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const buy=readFileSync("app/api/offers/buy-now/route.ts","utf8");
const offer=readFileSync("app/api/payments/create-intent/route.ts","utf8");
const refund=readFileSync("app/api/admin/commerce-lab/refund/route.ts","utf8");
const shipping=readFileSync("app/api/shipments/create-label/route.ts","utf8");
const pricing=readFileSync("lib/payments/pricing.ts","utf8");
test("both checkout paths keep item price in payment_intents.amount and fees separate",()=>{
 for(const [name,source] of [["buy-now",buy],["offer-checkout",offer]]){
   const payload=source.slice(source.indexOf('.from("payment_intents")'));
   assert.match(payload,/^\s*amount: pricing\.itemAmount/m,"missing item amount: "+name);
   assert.doesNotMatch(payload,/^\s*amount: pricing\.totalBuyerAmount/m,"double counted buyer total: "+name);
   assert.match(payload,/buyer_fee_amount: pricing\.buyerFeeAmount/);
   assert.match(payload,/shipping_amount: pricing\.shippingAmount/);
 }
});
test("buy-now records total for Stripe reconciliation without mixing ledger amount",()=>{
 assert.match(buy,/total_buyer_amount: pricing\.totalBuyerAmount/);
 assert.match(buy,/platform_fee_amount: pricing\.buyerFeeAmount/);
});
test("refund and shipping use explicit amount plus separately charged fees",()=>{
 assert.match(refund,/Number\(payment\.amount \|\| 0\) \+\s*Number\(payment\.buyer_fee_amount \|\| 0\) \+\s*Number\(payment\.shipping_amount \|\| 0\)/);
 assert.match(shipping,/itemAmount: Number\(payment\.amount \|\| 0\)/);
 assert.match(pricing,/totalBuyerAmount = roundCurrency\(itemAmount \+ buyerFeeAmount \+ shippingAmount\)/);
});
