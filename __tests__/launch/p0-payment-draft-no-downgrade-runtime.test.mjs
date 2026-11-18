import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const BUYER="11111111-1111-4111-8111-111111111111";
const SELLER="22222222-2222-4222-8222-222222222222";
const LISTING="33333333-3333-4333-8333-333333333333";
const CHAT="44444444-4444-4444-8444-444444444444";
const quote={itemAmount:15,deliveryMethod:"shipping",shipmentTier:"small",
 buyerFeeAmount:1.45,shippingAmount:2.99,sellerNetAmount:15,totalBuyerAmount:19.44};
const saved={
 id:"55555555-5555-4555-8555-555555555555",status:"requires_payment_method",
 amount:15,currency:"EUR",provider:"stripe",offer_id:BUYER,listing_id:LISTING,
 conversation_id:CHAT,buyer_id:BUYER,seller_id:SELLER,
 buyer_fee_amount:1.45,shipping_amount:2.99,seller_net_amount:15,
 platform_fee_amount:1.45,shipment_tier:"small",
 metadata:{source:"offer_acceptance",delivery_method:"shipping",total_buyer_amount:19.44}
};
function fixture(options={}){
 const calls=[],out={};
 const t=ts.transpileModule(readFileSync("lib/services/payments.service.ts","utf8"),{
  fileName:"payments.service.ts",reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
 });
 assert.equal(t.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(t.outputText,{exports:out,require:n=>{
  if(n==="@/lib/payments/pricing")return {
   isDeliveryMethod:x=>x==="in_person"||x==="shipping",
   isShipmentTier:x=>["none","small","medium","large"].includes(x),
   buildMarketplacePricing:()=>quote
  };
  throw Error("unexpected module "+n);
 },Date,Number,Math,Error},{timeout:1800});
 const client={from(table){
  calls.push("READ:"+table);
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>{
   if(table==="listing_offers")return {data:{
    id:BUYER,listing_id:LISTING,buyer_id:BUYER,seller_id:SELLER,
    status:"accepted",accepted_amount:15},error:null};
   if(table==="conversations")return {data:{id:CHAT},error:null};
   if(table==="payment_intents")return {data:options.previous??null,error:null};
   throw Error("unknown "+table);
  },insert:row=>{calls.push("INSERT:"+table);calls.push("INSERT_STATUS:"+row.status);return q;},
  single:async()=>({data:options.created??{...saved},error:options.conflict?{code:"23505"}:null}),
  upsert:()=>{calls.push("UPSERT");throw Error("FORBIDDEN_UPSERT");},
  update:()=>{calls.push("UPDATE");throw Error("FORBIDDEN_UPDATE");}
  };return q;
 }};
 return {calls,out,run:(overrides={})=>out.createPaymentIntentDraft({
   supabase:client,offerId:BUYER,buyerId:BUYER,
   deliveryMethod:"shipping",shipmentTier:"small",...overrides,
 })};
}
test("first draft inserts only after verified accepted offer, never UPSERT",async()=>{
 const h=fixture(),r=await h.run();
 assert.equal(r.paymentIntent.id,saved.id);
 assert.equal(h.calls.includes("UPSERT"),false);
 assert.equal(h.calls.filter(x=>x==="INSERT:payment_intents").length,1);
});
test("compatible repeat reads only and retains the original payment state",async()=>{
 const h=fixture({previous:saved}),r=await h.run();
 assert.equal(r.paymentIntent.id,saved.id);
 assert.equal(h.calls.some(x=>x.startsWith("INSERT")||x==="UPSERT"),false);
});
for(const [name,previous] of [
 ["already paid",{...saved,status:"succeeded"}],
 ["processing",{...saved,status:"processing"}],
 ["different buyer",{...saved,buyer_id:SELLER}],
 ["different conversation",{...saved,conversation_id:null}],
 ["different price",{...saved,amount:0}],
]){
 test(name+" cannot be downgraded or overwritten",async()=>{
  const h=fixture({previous});
  await assert.rejects(h.run(),/conciliaci/);
  assert.equal(h.calls.some(x=>x.startsWith("INSERT")||x==="UPSERT"||x==="UPDATE"),false);
 });
}
test("created financial row mismatching quote requires reconciliation, not retry",async()=>{
 const h=fixture({created:{...saved,amount:1}});
 await assert.rejects(h.run(),/conciliaci/);
 assert.equal(h.calls.filter(x=>x==="INSERT:payment_intents").length,1);
 assert.equal(h.calls.includes("UPSERT"),false);
});
test("unique index collision reports reconciliation without resetting payment",async()=>{
 const h=fixture({conflict:true});
 await assert.rejects(h.run(),/concurrente/);
 assert.equal(h.calls.includes("UPSERT"),false);
});
for(const [name,deliveryMethod,shipmentTier] of [
 ["explicit shipping none","shipping","none"],
 ["invalid delivery method","boat","small"],
 ["invalid shipping size","shipping","free"]
]){
 test(name+" fails before any SQL",async()=>{
  const h=fixture();
  await assert.rejects(h.run({deliveryMethod,shipmentTier}));
  assert.equal(h.calls.length,0);
 });
}
