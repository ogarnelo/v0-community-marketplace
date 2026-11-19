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
const shipping={id:SHIPMENT,buyer_id:BUYER,seller_id:SELLER,listing_id:LISTING,
 payment_intent_id:PAYMENT,status:"label_ready",payload:{}};
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
    data:writing?{id:SHIPMENT}:
      table==="shipments"?{...shipping,...options.shipment}:
      table==="payment_intents"?options.missingPayment?null:{...payment,...options.payment}:
      null,error:table==="payment_intents"&&options.dbDown?{message:"PRIVATE_DB"}:null
   }),
   insert:async()=>{calls.push("INSERT:"+table);return {error:null}}};
  return q;
 }};
 const mocks={
  "next/server":{NextResponse:{json:(obj,opts={})=>Response.json(obj,{
   status:opts.status??200,headers:opts.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>({
   auth:{getUser:async()=>({data:{user:{id:SELLER}},error:null})}
  })},
  "@/lib/supabase/admin":{createAdminClient:()=>admin},
  "@/lib/commerce/private-access":{canUserUseCommerce:async()=>true,
   isPublicCommerceEnabled:()=>false,assertStripeTestMode:()=>{}}
 };
 const compiled=ts.transpileModule(readFileSync("app/api/shipments/mark-dispatched/route.ts","utf8"),{
  reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,
   target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 assert.equal(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(compiled.outputText,{exports:out,require:n=>{
  assert.ok(n in mocks,"missing "+n);return mocks[n];
 },Request,Response,Date,URL,Promise,console:{error:()=>{}}},{timeout:2000});
 return {calls,post:async()=>{
  const r=await out.POST(new Request("https://wetudy.invalid/api/shipments/mark-dispatched",{
   method:"POST",body:JSON.stringify({shipmentId:SHIPMENT}),
   headers:{"content-type":"application/json"}
  }));
  return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json()};
 }};
}
for(const [name,changes,expectedStatus] of [
 ["payment missing",{missingPayment:true},409],
 ["missing payment link",{shipment:{payment_intent_id:null}},409],
 ["wrong buyer on payment",{payment:{buyer_id:SELLER}},409],
 ["wrong seller on payment",{payment:{seller_id:BUYER}},409],
 ["wrong listing on payment",{payment:{listing_id:SELLER}},409],
 ["wrong payment id",{payment:{id:SELLER}},409],
 ["in-person payment",{payment:{metadata:{delivery_method:"in_person"}}},409],
 ["payment processing",{payment:{status:"processing"}},409],
 ["payment read outage",{dbDown:true},503],
]){
 test(name+" cannot mark shipment in transit",async()=>{
  const h=fixture(changes),r=await h.post();
  assert.equal(r.status,expectedStatus,name);
  assert.equal(r.cache,"private, no-store");
  assert.equal(h.calls.some(x=>x.startsWith("UPDATE:")||x.startsWith("INSERT:")),false);
 });
}
test("seller can dispatch paid matching shipment with actor-scoped CAS",async()=>{
 const h=fixture(),r=await h.post();
 assert.equal(r.status,200);
 assert.equal(h.calls.includes("UPDATE:shipments"),true);
 assert.equal(h.calls.includes("EQ:shipments:seller_id:"+SELLER),true);
 assert.equal(h.calls.includes("EQ:shipments:payment_intent_id:"+PAYMENT),true);
 assert.equal(h.calls.includes("INSERT:shipment_events"),true);
});
