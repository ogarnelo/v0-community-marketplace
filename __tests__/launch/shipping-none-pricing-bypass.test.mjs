import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";

// Evaluate the actual TypeScript pricing function rather than matching only source text.
const source=readFileSync("lib/payments/pricing.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const pricing=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const {buildMarketplacePricing}=pricing;
test("malicious shipping + none must pay the real small-parcel fee",()=>{
 const quote=buildMarketplacePricing({itemAmount:20,deliveryMethod:"shipping",shipmentTier:"none"});
 assert.equal(quote.shipmentTier,"small");
 assert.equal(quote.shippingAmount,2.99);
 assert.equal(quote.buyerFeeAmount,1.70);
 assert.equal(quote.totalBuyerAmount,24.69);
});
test("legitimate pickup remains free, explicit valid shipping tiers preserved",()=>{
 const pickup=buildMarketplacePricing({itemAmount:20,deliveryMethod:"in_person",shipmentTier:"large"});
 assert.equal(pickup.shipmentTier,"none");
 assert.equal(pickup.shippingAmount,0);
 assert.equal(pickup.totalBuyerAmount,20);
 for(const [tier,price] of [["small",2.99],["medium",4.49],["large",6.99]]){
  const q=buildMarketplacePricing({itemAmount:20,deliveryMethod:"shipping",shipmentTier:tier});
  assert.equal(q.shipmentTier,tier);
  assert.equal(q.shippingAmount,price);
 }
});
test("service normalization independently rejects none on shipping",()=>{
 const source=readFileSync("lib/services/payments.service.ts","utf8");
 assert.match(source,/shipmentTier === "none" \? "small"/);
 assert.match(source,/buildMarketplacePricing\(/);
});
