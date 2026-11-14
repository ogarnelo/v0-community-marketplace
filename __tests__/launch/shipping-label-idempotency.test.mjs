import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const s=readFileSync("app/api/shipments/create-label/route.ts","utf8");
test("shipments lookup must validate payment/listing/address before external provider call",()=>{
 const external=s.indexOf("await createSendcloudParcel(");
 assert.ok(external>0);
 for(const marker of ["paymentResult.error","listingResult.error","buyerProfileResult.error",
   "payment.buyer_id !== shipment.buyer_id","payment.seller_id !== shipment.seller_id",
   "payment.listing_id !== shipment.listing_id"]){
   assert.ok(s.indexOf(marker)>=0 && s.indexOf(marker)<external, marker);
 }
});
test("label creation uses preflight single-winner state fence",()=>{
 const fence=s.indexOf("const { data: fencedShipment, error: fenceError }");
 const provider=s.indexOf("await createSendcloudParcel(");
 assert.ok(fence>=0 && fence<provider);
 assert.match(s,/sendcloud_attempted: true/);
 assert.match(s,/\.in\("status", \["draft", "quoted"\]\)/);
 assert.match(s,/if \(fenceError \|\| !fencedShipment\)/);
 assert.match(s,/shipment\.payload\?\.sendcloud_attempted === true/);
 assert.doesNotMatch(s,/\.in\("status", \["draft", "quoted", "label_pending"\]\)/);
});
test("provider ambiguity is not hidden by manual fallback that allows retry",()=>{
 const catchCode=s.slice(s.indexOf("} catch (error: any) {"));
 assert.doesNotMatch(catchCode,/provider: "manual"/);
 assert.doesNotMatch(catchCode,/manual_fallback/);
 assert.match(catchCode,/conciliación manual/);
});
