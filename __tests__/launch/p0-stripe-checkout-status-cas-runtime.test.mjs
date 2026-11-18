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
const CHAT="77777777-7777-4777-8777-777777777777";
const existing={id:PAYMENT,status:"requires_payment_method",shipment_tier:"small",
 buyer_id:BUYER,seller_id:SELLER,listing_id:LISTING,provider:"stripe",
 conversation_id:CHAT,amount:15,currency:"EUR",buyer_fee_amount:1.45,
 shipping_amount:2.99,seller_net_amount:15,metadata:{delivery_method:"shipping"}};
function fixture(opts={}){
 const events=[],out={};
 const stripe={checkout:{sessions:{
  create:async()=>{
   events.push("STRIPE_CREATE");
   return opts.createdSession??{id:"cs_synthetic",client_secret:"secret_synthetic",amount_total:1944,currency:"eur"};
  },
  retrieve:async()=>{events.push("STRIPE_RETRIEVE");if(opts.previousSession)return opts.previousSession;throw Error("MUST_NOT_RETRIEVE")},
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
    if(table==="conversations")return {data:{id:CHAT},error:null};
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

for(const [reason,record] of [
 ["wrong item price",{...existing,amount:12}],
 ["wrong protection fee",{...existing,buyer_fee_amount:0}],
 ["wrong delivery fee",{...existing,shipping_amount:0}],
 ["wrong seller net",{...existing,seller_net_amount:12}],
 ["wrong currency",{...existing,currency:"USD"}],
 ["wrong shipment tier",{...existing,shipment_tier:"large"}],
 ["wrong delivery method",{...existing,metadata:{delivery_method:"in_person"}}],
 ["wrong conversation",{...existing,conversation_id:SELLER}],
 ["missing price",{...existing,amount:null}],
]){
 test(reason+" prevents new Stripe session and payment rewrite",async()=>{
  const h=fixture({existing:record});
  await assert.rejects(h.start(),/conciliación/);
  assert.equal(h.events.includes("STRIPE_CREATE"),false);
  assert.equal(h.events.includes("UPDATE:payment_intents"),false);
 });
}
for(const [reason,created] of [
 ["different Stripe amount",{id:"cs_test",client_secret:"secret_test",amount_total:1,currency:"eur"}],
 ["wrong currency",{id:"cs_test",client_secret:"secret_test",amount_total:1944,currency:"usd"}],
 ["missing Stripe secret",{id:"cs_test",amount_total:1944,currency:"eur"}],
]){
 test(reason+" cannot persist payment or reserve listing",async()=>{
  const h=fixture({createdSession:created});
  await assert.rejects(h.start(),/conciliación/);
  assert.equal(h.events.includes("STRIPE_CREATE"),true);
  assert.equal(h.events.includes("INSERT:payment_intents"),false);
  assert.equal(h.events.includes("UPDATE:listings"),false);
 });
}
test("foreign preexisting Stripe session cannot be reused or expired",async()=>{
 const h=fixture({existing:{...existing,metadata:{
  delivery_method:"shipping",stripe_checkout_session_id:"cs_foreign"
 }},previousSession:{id:"cs_foreign",amount_total:1944,currency:"eur",
  payment_status:"unpaid",status:"open",client_secret:"secret_foreign",
  metadata:{offer_id:OFFER,buyer_id:SELLER,seller_id:SELLER,listing_id:LISTING}}});
 await assert.rejects(h.start(),/conciliación/);
 assert.equal(h.events.includes("STRIPE_RETRIEVE"),true);
 assert.equal(h.events.includes("STRIPE_CREATE"),false);
 assert.equal(h.events.includes("STRIPE_EXPIRE"),false);
});
test("same verified Stripe session can be reused without writes",async()=>{
 const h=fixture({existing:{...existing,metadata:{
  delivery_method:"shipping",stripe_checkout_session_id:"cs_ours"
 }},previousSession:{id:"cs_ours",amount_total:1944,currency:"eur",
  payment_status:"unpaid",status:"open",client_secret:"secret_ours",
  metadata:{offer_id:OFFER,buyer_id:BUYER,seller_id:SELLER,listing_id:LISTING}}});
 const r=await h.start();
 assert.equal(r.sessionId,"cs_ours");
 assert.equal(h.events.includes("STRIPE_CREATE"),false);
 assert.equal(h.events.includes("UPDATE:payment_intents"),false);
});


const provenPayment={
 id:PAYMENT,status:"requires_payment_method",offer_id:OFFER,listing_id:LISTING,
 buyer_id:BUYER,seller_id:SELLER,provider:"stripe",currency:"EUR",
 amount:15,buyer_fee_amount:1.45,shipping_amount:2.99,
 metadata:{source:"stripe_checkout",total_buyer_amount:19.44,
   stripe_checkout_session_id:"cs_verified"}
};
const provenSession={id:"cs_verified",payment_status:"paid",status:"complete",
 currency:"eur",amount_total:1944,
 metadata:{offer_id:OFFER,buyer_id:BUYER,seller_id:SELLER,listing_id:LISTING}};
function confirmationFixture(opts={}){
 const events=[],out={};
 const mods={
  "@/lib/stripe":{stripe:{checkout:{sessions:{
   retrieve:async()=>{events.push("STRIPE_RETRIEVE");return opts.session??provenSession;}
  }}}},
  "@/lib/supabase/server":{createClient:async()=>{
   events.push("CLIENT");
   return {auth:{getUser:async()=>({data:{user:{id:BUYER}},
    error:opts.authError?{name:"ProviderDown"}:null})}};
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{
   events.push("ADMIN");
   return {from:table=>{
    events.push("FROM:"+table);
    let updated=false;
    const q={
     select:()=>q,
     eq:(field,value)=>{events.push("EQ:"+table+":"+field+":"+value);return q;},
     in:(field,values)=>{events.push("IN:"+table+":"+field+":"+JSON.stringify(values));return q;},
     update:()=>{updated=true;events.push("UPDATE:"+table);return q;},
     maybeSingle:async()=>{
      if(!updated)return {data:opts.payment??provenPayment,
        error:opts.readError?{message:"PRIVATE_DB"}:null};
      const id=table==="payment_intents"?PAYMENT:
         table==="listing_offers"?OFFER:LISTING;
      const failed=opts.updateFail===table;
      return {data:failed?null:{id},error:null};
     }
    };
    return q;
   }};
  }},
  "@/lib/payments/pricing":{},
  "@/lib/payments/offer-amount":{},
  "@/lib/commerce/private-access":{canUserUseCommerce:async()=>true,
   isPublicCommerceEnabled:()=>false,assertStripeTestMode:()=>{}},
 };
 const src=readFileSync("app/actions/stripe.ts","utf8");
 const compiled=ts.transpileModule(src,{fileName:"stripe.ts",reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
   esModuleInterop:true}});
 assert.equal(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(compiled.outputText,{exports:out,require:n=>{
  assert.ok(n in mods,"Unexpected module "+n);return mods[n];
 },Date,Math,Number,Promise,Error},{timeout:2000});
 return {events,run:(params={offerId:OFFER})=>out.confirmPaymentComplete(params)};
}
test("verified Stripe paid proof updates three guarded rows and reports success",async()=>{
 const h=confirmationFixture(),res=await h.run();
 assert.equal(res.success,true);
 assert.deepEqual(h.events.filter(x=>x.startsWith("UPDATE:")),
  ["UPDATE:payment_intents","UPDATE:listing_offers","UPDATE:listings"]);
 assert.ok(h.events.includes("EQ:payment_intents:status:requires_payment_method"));
 assert.ok(h.events.includes('IN:listings:status:["reserved","sold"]'));
});
test("malformed offer UUID blocks Auth, Stripe and privileged SQL",async()=>{
 const h=confirmationFixture();
 await assert.rejects(h.run({offerId:"not-a-uuid"}),/inválida/);
 assert.deepEqual(h.events,[]);
});
test("Auth provider outage with residual user fails before service_role",async()=>{
 const h=confirmationFixture({authError:true});
 await assert.rejects(h.run(),/sesión/);
 assert.equal(h.events.includes("ADMIN"),false);
});
for(const [name,changes] of [
 ["missing recorded total",{metadata:{...provenPayment.metadata,total_buyer_amount:null}}],
 ["total does not match stored line items",{metadata:{...provenPayment.metadata,total_buyer_amount:15}}],
 ["invalid payment source",{metadata:{...provenPayment.metadata,source:"buy_now"}}],
 ["foreign payment provider",{provider:"other"}],
 ["different buyer on payment row",{buyer_id:SELLER}],
 ["missing seller",{seller_id:null}],
 ["canceled payment state",{status:"canceled"}],
 ["negative shipping",{shipping_amount:-1}],
 ["missing shipping",{shipping_amount:null}],
 ["different currency",{currency:"USD"}]
]){
 test(name+" cannot trigger Stripe or mark the payment paid",async()=>{
  const h=confirmationFixture({payment:{...provenPayment,...changes}});
  await assert.rejects(h.run(),/conciliación/);
  assert.equal(h.events.includes("STRIPE_RETRIEVE"),false);
  assert.equal(h.events.some(x=>x.startsWith("UPDATE:")),false);
 });
}
for(const [name,changes] of [
 ["foreign session buyer",{metadata:{...provenSession.metadata,buyer_id:SELLER}}],
 ["foreign session seller",{metadata:{...provenSession.metadata,seller_id:BUYER}}],
 ["foreign session listing",{metadata:{...provenSession.metadata,listing_id:SELLER}}],
 ["wrong Stripe total",{amount_total:1444}],
 ["wrong Stripe currency",{currency:"usd"}],
 ["session still open",{status:"open"}],
 ["session unpaid",{payment_status:"unpaid"}],
 ["unexpected session ID",{id:"cs_other"}]
]){
 test(name+" prevents every DB mutation",async()=>{
  const h=confirmationFixture({session:{...provenSession,...changes}});
  await assert.rejects(h.run(),/Stripe/);
  assert.equal(h.events.includes("STRIPE_RETRIEVE"),true);
  assert.equal(h.events.some(x=>x.startsWith("UPDATE:")),false);
 });
}
for(const table of ["payment_intents","listing_offers","listings"]){
 test(table+" concurrent missing update requires reconciliation",async()=>{
  const h=confirmationFixture({updateFail:table});
  await assert.rejects(h.run(),/conciliación/);
  assert.equal(h.events.includes("UPDATE:"+table),true);
 });
}
