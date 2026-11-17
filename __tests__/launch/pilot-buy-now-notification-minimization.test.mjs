import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("buy-now notification does not inject Auth email or user metadata into seller-facing text",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 const section=s.slice(s.indexOf('kind: "offer_accepted"'),s.indexOf('metadata: { listing_id:',s.indexOf('kind: "offer_accepted"')));
 assert.ok(section.length>0);
 assert.doesNotMatch(section,/user\.email|user\.user_metadata|email\s*\|\|/);
 assert.match(section,/Han iniciado una compra directa/);
 assert.match(section,/listing\.title/);
});
test("notification only happens after reserving the listing and preparing payment",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 const reserve=s.indexOf("await reserveAvailableListing");
 const pay=s.indexOf("await prepareBuyNowPaymentIntent");
 const notify=s.indexOf("const { error: notifyError }");
 assert.ok(reserve>=0&&pay>reserve&&notify>pay);
 assert.match(s,/if \(notifyError\) return privateJson/);
});
