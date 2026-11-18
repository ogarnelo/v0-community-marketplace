import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const BUYER="11111111-1111-4111-8111-111111111111";
const SELLER="22222222-2222-4222-8222-222222222222";
const LISTING="33333333-3333-4333-8333-333333333333";
const OFFER="44444444-4444-4444-8444-444444444444";
const PAYMENT="55555555-5555-4555-8555-555555555555";
const price={itemAmount:15,deliveryMethod:"shipping",shipmentTier:"small",
 buyerFeeAmount:1.45,shippingAmount:2.99,sellerNetAmount:15,totalBuyerAmount:19.44};
const existing={id:PAYMENT,status:"requires_payment_method",shipment_tier:"small",
 buyer_id:BUYER,seller_id:SELLER,listing_id:LISTING,provider:"stripe",metadata:{}};
function fixture(opts={}){
 const events=[],out={};
 const stripe={checkout:{sessions:{
  create:async()=>{
   events.push("STRIPE_CREATE");
   return {id:"cs_synthetic",client_secret:"secret_synthetic"};
  },
  retrieve:async()=>{events.push("STRIPE_RETRIEVE");throw Error("MUST_NOT_RETRIEVE")},
  expire:async()=>{events.push("STRIPE_EXPIRE");throw Error("MUST_NOT_EXPIRE")}
 }}};
 const admin={from(table){
  events.push("FROM:"+table);
  let operation="read";
  const q={
   select:()=>q,
   eq:(key,value)=>{events.push("EQ:"+table+":"+key+":"+value);return q;},
   maybeSingle:async()=>{
    if(table==="listing_offers")return {data:{id:OFFER,listing_id:LISTING,
      buyer_id:BUYER,seller_id:SELLER,status:"accepted",accepted_amount:15,
      listings:{id:LISTING,title:"Synthetic",description:"none",status:"available"}},error:null};
    if(table==="conversations")return {data:{id:"77777777-7777-4777-8777-777777777777"},error:null};
    if(table==="payment_intents"){
      if(operation==="update")return {data:opts.updateMissing?null:{id:PAYMENT},
        error:opts.updateError?{message:"PRIVATE_WRITE"}:null};
      return {data:opts.existing??null,error:null};
    }
    return {data:null,error:null};
   },
   insert:()=>{operation="insert";events.push("INSERT:"+table);return q;},
   update:()=>{operation="update";events.push("UPDATE:"+table);return q;},
   single:async()=>({data:opts.insertFailure?null:{id:PAYMENT},
      error:opts.insertFailure?{code:"23505",message:"PRIVATE_INSERT"}:null}),
   then:(resolve,reject)=>Promise.resolve({error:null}).then(resolve,reject),
   upsert:()=>{events.push("UPSERT");throw Error("FORBIDDEN_UPSERT")}
  };
  return q;
 }};
 const mocks={
  "@/lib/stripe":{stripe},
  "@/lib/supabase/server":{createClient:async()=>{events.push("CLIENT");
   return {auth:{getUser:async()=>({data:{user:{id:BUYER}},error:null})}};
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{events.push("ADMIN");return admin}},
  "@/lib/payments/pricing":{buildMarketplacePricing:()=>price,
   isDeliveryMethod:x=>x==="shipping"||x==="in_person",
   isShipmentTier:x=>["none","small","medium","large"].includes(x)},
  "@/lib/payments/offer-amount":{getAcceptedOfferAmount:()=>15},
  "@/lib/commerce/private-access":{canUserUseCommerce:async()=>true,
    isPublicCommerceEnabled:()=>false,assertStripeTestMode:()=>{}},
 };
 const compiled=ts.transpileModule(readFileSync("app/actions/stripe.ts","utf8"),{
  fileName:"stripe.ts",reportDiagnostics:true,compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
  }
 });
 assert.equal(compiled.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(compiled.outputText,{exports:out,require:n=>{
  assert.ok(n in mocks,"unexpected module "+n);return mocks[n];
 },Date,Math,Number,Promise,Error},{timeout:2500});
 return {events,start:(more={})=>out.startCheckoutSession({
  offerId:OFFER,deliveryMethod:"shipping",shipmentTier:"small",...more
 })};
}
for(const [name,params] of [
 ["shipping none",{shipmentTier:"none"}],
 ["unknown delivery",{deliveryMethod:"motorbike"}],
 ["invalid tier",{shipmentTier:"free"}],
 ["in-person with stale shipping tier",{deliveryMethod:"in_person",shipmentTier:"small"}],
 ["bad offer id",{offerId:"not-uuid"}],
]){
 test(name+" fails before Auth, admin and Stripe",async()=>{
  const h=fixture();
  await assert.rejects(h.start(params),/inválidos/);
  assert.deepEqual(h.events,[]);
 });
}
for(const [name,prior] of [
 ["already paid",{...existing,status:"succeeded"}],
 ["processing",{...existing,status:"processing"}],
 ["different buyer",{...existing,buyer_id:SELLER}],
 ["different seller",{...existing,seller_id:BUYER}],
 ["different listing",{...existing,listing_id:SELLER}],
 ["different provider",{...existing,provider:"other"}],
]){
 test(name+" cannot trigger Stripe or reset payment",async()=>{
  const h=fixture({existing:prior});
  await assert.rejects(h.start(),/conciliación/);
  assert.equal(h.events.includes("STRIPE_CREATE"),false);
  assert.equal(h.events.includes("UPDATE:payment_intents"),false);
  assert.equal(h.events.includes("INSERT:payment_intents"),false);
 });
}
test("pending payment can only be updated with status compare-and-set",async()=>{
 const h=fixture({existing});
 const r=await h.start();
 assert.equal(r.sessionId,"cs_synthetic");
 assert.equal(h.events.includes("STRIPE_CREATE"),true);
 assert.equal(h.events.includes("UPDATE:payment_intents"),true);
 assert.ok(h.events.includes("EQ:payment_intents:status:requires_payment_method"));
 assert.equal(h.events.includes("UPSERT"),false);
});
test("concurrent webhook status transition prevents successful checkout",async()=>{
 const h=fixture({existing,updateMissing:true});
 await assert.rejects(h.start(),/conciliación/);
 assert.equal(h.events.includes("STRIPE_CREATE"),true);
 assert.equal(h.events.includes("UPDATE:payment_intents"),true);
 assert.equal(h.events.includes("UPSERT"),false);
});
test("first session inserts a row, never upserts",async()=>{
 const h=fixture();
 const r=await h.start();
 assert.equal(r.sessionId,"cs_synthetic");
 assert.equal(h.events.filter(x=>x==="INSERT:payment_intents").length,1);
 assert.equal(h.events.includes("UPSERT"),false);
});
test("post-provider payment INSERT conflict requires reconciliation",async()=>{
 const h=fixture({insertFailure:true});
 await assert.rejects(h.start(),/conciliación/);
 assert.equal(h.events.includes("STRIPE_CREATE"),true);
 assert.equal(h.events.includes("UPSERT"),false);
});
