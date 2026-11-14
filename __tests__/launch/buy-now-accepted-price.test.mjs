import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
const amount=readFileSync("lib/payments/offer-amount.ts","utf8");
test("buy now selects agreed amount for previously accepted offer, not listing price",()=>{
 assert.match(s,/import \{ getAcceptedOfferAmount \} from "@\/lib\/payments\/offer-amount"/);
 assert.match(s,/\.select\("id, status, accepted_amount, current_amount, counter_price, offered_price"\)/);
 const use=s.indexOf('if (activeOffer?.status === "accepted")');
 const amountCheck=s.indexOf("getAcceptedOfferAmount(activeOffer)");
 const pricing=s.indexOf("const pricing = buildMarketplacePricing(");
 const insert=s.indexOf('.from("payment_intents")');
 assert.ok(use>0 && amountCheck>use && pricing>amountCheck && insert>pricing);
 assert.match(s.slice(use,pricing),/status: 409/);
 assert.match(amount,/offer\.accepted_amount \?\?/);
});
test("new buy-now purchase still uses catalog price; accepted offer may be discounted",()=>{
 assert.match(s,/let itemAmount = Number\(listing\.price \?\? 0\)/);
 assert.match(s,/if \(!offerId\) \{/);
 assert.match(s,/offered_price: itemAmount,/);
 assert.match(s,/amount: pricing\.itemAmount/);
});
