import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111", SELLER="22222222-2222-4222-8222-222222222222";
const pricing={itemAmount:10,totalBuyerAmount:13,buyerFeeAmount:1,shippingAmount:2,
 sellerNetAmount:9,shipmentTier:"small"};
const saved={id:ID,amount:13,currency:"EUR",status:"requires_payment_method",provider:"stripe",
 offer_id:ID,listing_id:ID,buyer_id:ID,seller_id:SELLER,school_id:null,
 buyer_fee_amount:1,shipping_amount:2,seller_net_amount:9,shipment_tier:"small",
 metadata:{source:"buy_now",delivery_method:"shipping",item_amount:10}};
function moduleUnderTest(){
 const exports={},source=readFileSync("lib/payments/safe-buy-now-intent.ts","utf8");
 const c=ts.transpileModule(source,{fileName:"safe-buy-now-intent.ts",reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal(c.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(c.outputText,{exports,require:()=>({}),Error,Number,Math,Date,Promise},
 {filename:"safe-buy-now-intent.ts",timeout:1800});
 return exports;
}
function run(params={}){
 const events=[];
 const query=(table)=>{
  const q={
   select:()=>q,eq:()=>q,
   maybeSingle:async()=>({data:params.previous??null,
     error:params.readError?{message:"PRIVATE_READ"}:null}),
   insert:(row)=>{events.push("INSERT:"+table);events.push("STATUS:"+row.status);return q;},
   single:async()=>({data:params.conflict||params.insertError?null:{...saved},
    error:params.conflict?{code:"23505",message:"PRIVATE_UNIQUE"}:
      params.insertError?{message:"PRIVATE_INSERT"}:null}),
   upsert:()=>{events.push("UPSERT:"+table);throw Error("MUST_NOT_UPSERT");},
   update:()=>{events.push("UPDATE:"+table);throw Error("MUST_NOT_UPDATE");}
  };return q;
 };
 const pkg=moduleUnderTest();
 const payload={admin:{from:query},listing:{id:ID,seller_id:SELLER,school_id:null},
  userId:ID,offerId:ID,conversationId:ID,pricing,deliveryMethod:"shipping",now:"2026-11-17T08:00:00Z"};
 return {events,perform:()=>pkg.prepareBuyNowPaymentIntent(payload)};
}
test("first payment uses INSERT, never UPSERT or UPDATE",async()=>{
 const x=run(),r=await x.perform();
 assert.equal(r.status,"requires_payment_method");assert.equal(r.amount,13);
 assert.deepEqual(x.events,["INSERT:payment_intents","STATUS:requires_payment_method"]);
});
test("compatible repeat reuses the record read-only",async()=>{
 const x=run({previous:saved}),r=await x.perform();
 assert.equal(r.id,ID);assert.deepEqual(x.events,[]);
});
for(const [reason,record] of [
 ["already succeeded",{...saved,status:"succeeded"}],
 ["processing",{...saved,status:"processing"}],
 ["another buyer",{...saved,buyer_id:SELLER}],
 ["different seller",{...saved,seller_id:ID}],
 ["different listing",{...saved,listing_id:SELLER}],
 ["different total",{...saved,amount:14}],
 ["different item",{...saved,metadata:{...saved.metadata,item_amount:12}}],
 ["different shipping",{...saved,shipping_amount:5}],
 ["different fee",{...saved,buyer_fee_amount:2}],
 ["different net",{...saved,seller_net_amount:8}],
 ["different shipment tier",{...saved,shipment_tier:"large"}],
 ["different source",{...saved,metadata:{...saved.metadata,source:"offer_acceptance"}}],
 ["different delivery",{...saved,metadata:{...saved.metadata,delivery_method:"in_person"}}],
 ["different provider",{...saved,provider:"other"}],
 ["missing fields",{...saved,buyer_fee_amount:null}]
]){
 test(reason+" => 409 without INSERT",async()=>{
  const x=run({previous:record});
  await assert.rejects(x.perform(),e=>e.status===409&&!/PRIVATE_|MUST_NOT/.test(e.publicMessage));
  assert.deepEqual(x.events,[]);
 });
}
for(const [scenario,config,status] of [
 ["unique conflict",{conflict:true},409],
 ["lookup down",{readError:true},503],
 ["insert down",{insertError:true},503]
]){
 test(scenario+" preserves state, no provider error echo",async()=>{
  const x=run(config);
  await assert.rejects(x.perform(),e=>e.status===status&&!/PRIVATE_|MUST_NOT/.test(e.publicMessage));
  assert.equal(x.events.some(y=>y.startsWith("UPSERT:")||y.startsWith("UPDATE:")),false);
 });
}
test("route Auth errors cannot reach service role; all JSON responses private",()=>{
 const route=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.match(route,/const \{ data: authData, error: authError \}/);
 assert.match(route,/if \(authError\)/);
 assert.ok(route.indexOf("if (authError)")<route.indexOf("const admin = createAdminClient()"));
 assert.match(route,/private, no-store/);
 assert.doesNotMatch(route,/\.upsert\(/);
 assert.doesNotMatch(route,/paymentError\?\.message/);
});
test("existing concurrent chat winner is recovered, and side effects errors are checked",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 for(const part of ['conversationError?.code === "23505"',"if (unhideError)","if (activeOfferError)",
 "if (eventError","if (messageError)","if (touchError","if (notifyError)"])
  assert.ok(s.includes(part),part);
});
