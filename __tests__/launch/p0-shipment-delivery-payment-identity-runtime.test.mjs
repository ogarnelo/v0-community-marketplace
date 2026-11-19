import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const BUYER="11111111-1111-4111-8111-111111111111";
const SELLER="22222222-2222-4222-8222-222222222222";
const LISTING="33333333-3333-4333-8333-333333333333";
const PAYMENT="44444444-4444-4444-8444-444444444444";
const SHIPMENT="55555555-5555-4555-8555-555555555555";
const shipping={id:SHIPMENT,buyer_id:BUYER,seller_id:SELLER,
 listing_id:LISTING,payment_intent_id:PAYMENT,status:"in_transit"};
const payment={id:PAYMENT,buyer_id:BUYER,seller_id:SELLER,listing_id:LISTING,
 status:"succeeded",metadata:{delivery_method:"shipping"}};
function fixture(options={}){
 const calls=[],out={};
 const admin={from:table=>{
  calls.push("READ:"+table);
  let writing=false;
  const q={select:()=>q,eq:(k,v)=>{calls.push("EQ:"+table+":"+k+":"+v);return q;},
   update:()=>{writing=true;calls.push("UPDATE:"+table);return q;},
   maybeSingle:async()=>({
    data:writing?{id:table==="shipments"?SHIPMENT:PAYMENT}:
      table==="shipments"?{...shipping,...options.shipment}:
      table==="payment_intents"?options.missingPayment?null:{...payment,...options.payment}:
      null,error:null}),
   insert:async()=>{calls.push("INSERT:"+table);return {error:null}}};
  return q;
 }};
 const modules={
  "next/server":{NextResponse:{json:(body,config={})=>Response.json(body,
    {status:config.status??200,headers:config.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>({
   auth:{getUser:async()=>({data:{user:{id:BUYER}},error:null})}})},
  "@/lib/supabase/admin":{createAdminClient:()=>admin},
  "@/lib/commerce/private-access":{canUserUseCommerce:async()=>true,
   isPublicCommerceEnabled:()=>false,assertStripeTestMode:()=>{}}
 };
 const compiled=ts.transpileModule(readFileSync("app/api/shipments/mark-delivered/route.ts","utf8"),{
  reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,
   target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 assert.equal(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(compiled.outputText,{exports:out,require:n=>{
  assert.ok(n in modules,"missing "+n);return modules[n];
 },Request,Response,Date,Promise,Number,console:{error:()=>{}}},{timeout:2000});
 return {calls,post:async()=>{
  const r=await out.POST(new Request("https://wetudy.invalid/api/shipments/mark-delivered",{
   method:"POST",body:JSON.stringify({shipmentId:SHIPMENT}),
   headers:{"content-type":"application/json"}
  }));
  return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json()};
 }};
}
for(const [description,opts] of [
 ["missing payment link",{shipment:{payment_intent_id:null}}],
 ["missing linked payment",{missingPayment:true}],
 ["foreign payment buyer",{payment:{buyer_id:SELLER}}],
 ["foreign payment seller",{payment:{seller_id:BUYER}}],
 ["foreign payment listing",{payment:{listing_id:SELLER}}],
 ["wrong payment id",{payment:{id:SELLER}}],
 ["shipping was not purchased",{payment:{metadata:{delivery_method:"in_person"}}}],
 ["payment is processing",{payment:{status:"processing"}}],
 ["shipment has no seller",{shipment:{seller_id:null}}]
]){
 test(description+" blocks delivery event and DB mutation",async()=>{
  const h=fixture(opts),r=await h.post();
  assert.equal(r.status,409,description);
  assert.equal(r.cache,"private, no-store");
  assert.equal(h.calls.some(x=>x.startsWith("UPDATE:")||x.startsWith("INSERT:")),false);
 });
}
test("valid buyer and paid shipping may confirm without crossing payment scope",async()=>{
 const h=fixture(),r=await h.post();
 assert.equal(r.status,200);
 assert.equal(h.calls.includes("UPDATE:shipments"),true);
 assert.equal(h.calls.includes("EQ:shipments:payment_intent_id:"+PAYMENT),true);
 assert.equal(h.calls.includes("EQ:payment_intents:buyer_id:"+BUYER),true);
 assert.equal(h.calls.includes("INSERT:shipment_events"),true);
});
