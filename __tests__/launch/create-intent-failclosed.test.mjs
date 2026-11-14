import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const code=readFileSync("app/api/payments/create-intent/route.ts","utf8");
test("offer/listing/conversation lookup errors abort before payment insert",()=>{
 const insert=code.indexOf('.from("payment_intents")\n      .insert(');
 assert.ok(insert>0);
 for(const name of ["offerLookupError","listingLookupError","conversationLookupError"]){
  const check=code.indexOf("if ("+name+")");
  assert.ok(check>=0&&check<insert,name+" guard must precede insert");
  assert.match(code.slice(check,check+200),/status: 503/);
 }
});
test("sold items cannot initiate additional checkout, fees and amount consistent",()=>{
 assert.match(code,/!\["available", "reserved"\]\.includes\(String\(listing\.status\)\)/);
 assert.doesNotMatch(code,/\["available", "reserved", "sold"\]/);
 assert.match(code,/amount: pricing\.itemAmount/);
 assert.match(code,/platform_fee_amount: pricing\.buyerFeeAmount/);
 assert.match(code,/total_buyer_amount: pricing\.totalBuyerAmount/);
});
test("reserved listing write error is returned, not silently ignored",()=>{
 assert.match(code,/const \{ error: reserveError \} = await adminSupabase/);
 assert.match(code,/if \(reserveError\)/);
});
