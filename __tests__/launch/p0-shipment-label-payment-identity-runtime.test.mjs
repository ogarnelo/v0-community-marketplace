import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const SELLER="22222222-2222-4222-8222-222222222222";
const LISTING="33333333-3333-4333-8333-333333333333";
const PAYMENT="44444444-4444-4444-8444-444444444444";
const shipment={id:ID,seller_id:SELLER,buyer_id:ID,listing_id:LISTING,
 payment_intent_id:PAYMENT,status:"draft",shipment_tier:"small",label_url:null};
const payment={id:PAYMENT,listing_id:LISTING,buyer_id:ID,seller_id:SELLER,
 status:"succeeded",amount:12,shipping_amount:2.99,shipment_tier:"small",
 metadata:{delivery_method:"shipping"}};
const address={full_name:"Test",shipping_address_line1:"Somewhere",shipping_city:"Madrid",
 postal_code:"28001",shipping_country_code:"ES"};
function fixture(options={}){
 const calls=[],out={};
 const qtable=table=>{
  calls.push("READ:"+table);
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({
   data:table==="shipments"?{...shipment,...options.shipment}:
     table==="payment_intents"?{...payment,...options.payment}:
     table==="listings"?{id:LISTING,title:"Test"}:
     table==="profiles"?address:null,error:null
  }),update:()=>{calls.push("UPDATE:"+table);return q;},
  then:(resolve,reject)=>Promise.resolve({error:null}).then(resolve,reject)};
  return q;
 };
 const modules={
  "next/server":{NextResponse:{json:(body,opts={})=>Response.json(body,
   {status:opts.status??200,headers:opts.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>({
   auth:{getUser:async()=>({data:{user:{id:SELLER}},error:null})}
  })},
  "@/lib/supabase/admin":{createAdminClient:()=>({from:qtable})},
  "@/lib/logistics/sendcloud":{
    isSendcloudConfigured:()=>true,
    createSendcloudParcel:async()=>{calls.push("SENDCLOUD");throw Error("MOCK_NOT_REAL")}
  },
  "@/lib/commerce/private-access":{
    canUserUseCommerce:async()=>true,isPublicCommerceEnabled:()=>false,
    assertStripeTestMode:()=>{},isPrivateShippingLabelCreationEnabled:()=>true
  }
 };
 const source=readFileSync("app/api/shipments/create-label/route.ts","utf8");
 const compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
 }});
 assert.equal(compiled.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(compiled.outputText,{exports:out,require:name=>{
  assert.ok(name in modules,"missing mock: "+name);return modules[name];
 },Date,URL,Request,Response,Number,Math,Promise,Boolean,console:{error:()=>{}}},{timeout:2000});
 return {calls,post:async()=>{
  const r=await out.POST(new Request("https://wetudy.invalid/api/shipments/create-label",{
   method:"POST",body:JSON.stringify({shipmentId:ID}),
   headers:{"content-type":"application/json"}
  }));
  return {status:r.status,body:await r.json(),cache:r.headers.get("cache-control")};
 }};
}
for(const [name,extra] of [
 ["foreign buyer",{payment:{buyer_id:SELLER}}],
 ["foreign seller",{payment:{seller_id:ID}}],
 ["foreign listing",{payment:{listing_id:SELLER}}],
 ["wrong paid intent id",{payment:{id:SELLER}}],
 ["in-person fee",{payment:{metadata:{delivery_method:"in_person"}}}],
 ["no shipment buyer",{shipment:{buyer_id:null}}],
 ["zero paid shipping",{payment:{shipping_amount:0}}],
 ["mismatched tier",{payment:{shipment_tier:"large"}}],
 ["free shipment tier",{shipment:{shipment_tier:"none"}}],
 ["missing shipment listing",{shipment:{listing_id:null}}]
]){
 test(name+" cannot create external label",async()=>{
  const h=fixture(extra),r=await h.post();
  assert.equal(r.status,409,name);
  assert.equal(r.cache,"private, no-store");
  assert.equal(h.calls.includes("SENDCLOUD"),false);
  assert.equal(h.calls.includes("UPDATE:shipments"),false);
 });
}
test("consistent paid shipping and actors passes authorization for provider",async()=>{
 const h=fixture(),r=await h.post();
 assert.equal(h.calls.includes("SENDCLOUD"),true);
 assert.equal(r.status,500); // fake provider deliberately throws
 assert.equal(r.cache,"private, no-store");
});
