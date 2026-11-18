import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
function fixture(){
 const calls=[],out={};
 const modules={
  "next/server":{NextResponse:{json:(body,opts={})=>Response.json(body,{status:opts.status??200,headers:opts.headers})}},
  "@/lib/supabase/server":{createClient:async()=>({
    auth:{getUser:async()=>({data:{user:{id:ID}},error:null})}
  })},
  "@/lib/supabase/admin":{createAdminClient:()=>{
   calls.push("ADMIN");
   const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:null,error:null})};
   return {from:table=>{calls.push("FROM:"+table);return q}};
  }},
  "@/lib/payments/pricing":{buildMarketplacePricing:()=>{throw Error("MUST_NOT_PRICE")}},
  "@/lib/offers/chat-message":{},
  "@/lib/notifications":{},
  "@/lib/marketplace/listing-type":{},
  "@/lib/commerce/private-access":{
    canUserUseCommerce:async()=>true,isPublicCommerceEnabled:()=>false,
    assertStripeTestMode:()=>{},isPrivateShippingLabelCreationEnabled:()=>false
  },
  "@/lib/analytics/product-events.server":{},
  "@/lib/payments/safe-buy-now-intent":{},
  "@/lib/commerce/buy-now-reservation":{},
 };
 const source=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 const compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{
   module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
 }});
 assert.equal(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(compiled.outputText,{exports:out,require:n=>{
   assert.ok(n in modules,"Unknown module "+n);return modules[n];
 },Request,Response,Date,Promise,console:{error:()=>{}}},{timeout:1800});
 return {calls,post:async(body)=>{
  const req=new Request("https://wetudy.invalid/api/offers/buy-now",{method:"POST",
   body:typeof body==="string"?body:JSON.stringify(body),headers:{"content-type":"application/json"}});
  const res=await out.POST(req);
  return {status:res.status,cache:res.headers.get("cache-control"),json:await res.json()};
 }};
}
for(const [name,body] of [
 ["shipping tier none",{listingId:ID,deliveryMethod:"shipping",shipmentTier:"none"}],
 ["invalid explicit delivery method",{listingId:ID,deliveryMethod:"boat"}],
 ["invalid explicit shipping tier",{listingId:ID,deliveryMethod:"shipping",shipmentTier:"free"}],
 ["invalid JSON","{"],
 ["array payload",[]],
 ["null payload",null],
]){
 test(name+" is 400 before privileged reads or reservation",async()=>{
  const h=fixture(),res=await h.post(body);
  assert.equal(res.status,400,name);
  assert.equal(res.cache,"private, no-store");
  assert.deepEqual(h.calls,[]);
 });
}
for(const [name,body] of [
 ["legacy omitted delivery defaults to in-person",{listingId:ID}],
 ["explicit small paid shipping",{listingId:ID,deliveryMethod:"shipping",shipmentTier:"small"}],
 ["missing shipping tier defaults to small",{listingId:ID,deliveryMethod:"shipping"}],
 ["explicit in-person with obsolete shipping size",{listingId:ID,deliveryMethod:"in_person",shipmentTier:"small"}],
]){
 test(name+" remains eligible for normal listing lookup",async()=>{
  const h=fixture(),res=await h.post(body);
  assert.equal(res.status,404);
  assert.equal(res.cache,"private, no-store");
  assert.deepEqual(h.calls,["ADMIN","FROM:listings"]);
 });
}
