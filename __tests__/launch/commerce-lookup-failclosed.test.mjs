import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const refund=readFileSync("app/api/admin/commerce-lab/refund/route.ts","utf8");
const transfer=readFileSync("app/api/admin/commerce-lab/release-transfer/route.ts","utf8");
test("refund cannot run if refund or transfer inventory queries fail",()=>{
 assert.match(refund,/const \{ data: transfer, error: transferLookupError \}/);
 assert.match(refund,/if \(transferLookupError\) throw transferLookupError/);
 assert.equal((refund.match(/if \(existingRefundError\) throw existingRefundError/g)||[]).length,2);
 assert.match(refund,/if \(!existingRefund\) return NextResponse\.json/);
 const providerAction=refund.indexOf("stripe.refunds.create(");
 assert.ok(providerAction>refund.indexOf("if (transferLookupError)"));
});
test("fund release stops before Stripe transfer if any safety lookup errors",()=>{
 for(const [key,variable] of [["existingRefund","existingRefundError"],["shipment","shipmentLookupError"],["connectRow","connectLookupError"],["existingTransfer","transferLookupError"]]){
  assert.ok(transfer.includes("data: "+key+", error: "+variable));
  assert.ok(transfer.includes("if ("+variable+") throw "+variable));
 }
 const transferCreate=transfer.indexOf("stripe.transfers.create(");
 assert.ok(transferCreate>transfer.indexOf("if (transferLookupError)"));
});
