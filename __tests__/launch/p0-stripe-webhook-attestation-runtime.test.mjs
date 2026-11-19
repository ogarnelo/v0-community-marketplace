import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const OFFER="44444444-4444-4444-8444-444444444444";
const BUYER="11111111-1111-4111-8111-111111111111";
const SELLER="22222222-2222-4222-8222-222222222222";
const LISTING="33333333-3333-4333-8333-333333333333";
const session={id:"cs_registered",payment_status:"paid",currency:"eur",amount_total:1944,
 metadata:{offer_id:OFFER,buyer_id:BUYER,seller_id:SELLER,listing_id:LISTING}};
const payment={id:"55555555-5555-4555-8555-555555555555",offer_id:OFFER,
 buyer_id:BUYER,seller_id:SELLER,listing_id:LISTING,provider:"stripe",currency:"EUR",
 status:"requires_payment_method",amount:15,buyer_fee_amount:1.45,shipping_amount:2.99,
 shipment_tier:"small",metadata:{source:"stripe_checkout",
 total_buyer_amount:19.44,stripe_checkout_session_id:"cs_registered"}};
function fixture({sessionChanges={},paymentChanges={},type="checkout.session.completed",paymentCasLost=false,listingCasLost=false}={}){
 const events=[],out={};
 const fullSession={...session,...sessionChanges,
  metadata:{...session.metadata,...sessionChanges.metadata}};
 const row={...payment,...paymentChanges,
  metadata:{...payment.metadata,...paymentChanges.metadata}};
 class StripeMock{
   constructor(){this.webhooks={constructEvent:()=>({
    id:"evt_synthetic",livemode:false,type,data:{object:fullSession}
   })}}
 }
 const deps={
   "next/server":{NextResponse:{json:(obj,opts={})=>Response.json(obj,{
    status:opts.status??200,headers:opts.headers??{}
   })}},
   "stripe":StripeMock,
   "@/lib/supabase/admin":{createAdminClient:()=>{
    events.push("ADMIN");
    return {from:table=>{
     events.push("FROM:"+table);
     let updating=false;
     const q={select:()=>q,
      eq:(key,value)=>{events.push("EQ:"+table+":"+key+":"+value);return q;},
      maybeSingle:async()=>({
       data:!updating?(table==="payment_intents"?row:null):
        (table==="payment_intents" && paymentCasLost ||
         table==="listings" && listingCasLost)?null:
        table==="payment_intents"?{id:row.id}:
        table==="listings"?{id:LISTING}:null,
       error:null
      }),
      update:()=>{updating=true;events.push("UPDATE:"+table);return q;},
      neq:()=>q,in:()=>q,
      insert:async()=>{events.push("INSERT:"+table);return {error:null}}
     };
     return q;
    }};
   }},
   "@/lib/commerce/private-access":{
    assertStripeTestMode:()=>{},isPublicCommerceEnabled:()=>false,
    isPrivateCommercePreviewEnabled:()=>true
   },
   "@/lib/commerce/connect":{syncSellerConnectAccountSnapshot:async()=>{throw Error("NEVER_CONNECT")}}
 };
 const result=ts.transpileModule(readFileSync("app/api/stripe/webhook/route.ts","utf8"),{
  fileName:"webhook/route.ts",reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}
 });
 assert.equal(result.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(result.outputText,{exports:out,require:x=>{
  assert.ok(x in deps,"Unexpected import: "+x);return deps[x];
 },process:{env:{STRIPE_SECRET_KEY:"sk_test_mock",STRIPE_WEBHOOK_SECRET:"whsec_mock"}},
 Response,Request,Date,Number,Math,Error,console:{error:()=>{}},
 },{timeout:2000});
 return {events,post:async()=>{
  const r=await out.POST(new Request("https://wetudy.invalid/api/stripe/webhook",{
    method:"POST",headers:{"stripe-signature":"mock"},body:"mock"
  }));
  return {status:r.status,body:await r.json()};
 }};
}
for(const [name,sessionChanges,paymentChanges] of [
 ["session id absent",{id:null},{}],
 ["unregistered payment session",{}, {metadata:{stripe_checkout_session_id:null}}],
 ["different registered session",{}, {metadata:{stripe_checkout_session_id:"cs_other"}}],
 ["seller mismatch",{metadata:{seller_id:BUYER}},{}],
 ["listing mismatch",{metadata:{listing_id:SELLER}},{}],
 ["buyer mismatch",{metadata:{buyer_id:SELLER}},{}],
 ["wrong provider",{}, {provider:"other"}],
 ["wrong currency",{currency:"usd"},{}],
 ["missing total",{}, {metadata:{total_buyer_amount:null}}],
 ["wrong total",{amount_total:100},{}],
 ["missing fee",{}, {buyer_fee_amount:null}],
 ["inconsistent line items",{}, {shipping_amount:0}],
 ["foreign payment source",{}, {metadata:{source:"buy_now"}}]
]){
 test(name+" fails before any payment, listing or audit write",async()=>{
  const h=fixture({sessionChanges,paymentChanges}),res=await h.post();
  assert.equal(res.status,500,name);
  assert.equal(h.events.some(x=>x.startsWith("UPDATE:")||x.startsWith("INSERT:")),false,name);
 });
}
test("valid signed Stripe invoice reaches payment update",async()=>{
 const h=fixture(),res=await h.post();
 assert.equal(res.status,200);
 assert.equal(h.events.includes("UPDATE:payment_intents"),true);
});
test("async_payment_succeeded without paid state never mutates DB",async()=>{
 const h=fixture({sessionChanges:{payment_status:"unpaid"},
  type:"checkout.session.async_payment_succeeded"}),res=await h.post();
 assert.equal(res.status,500);
 assert.equal(h.events.some(x=>x.startsWith("UPDATE:")||x.startsWith("INSERT:")),false);
});

test("processing event cannot downgrade an already succeeded payment",async()=>{
 const h=fixture({paymentChanges:{status:"succeeded"},
  sessionChanges:{payment_status:"unpaid"}}),r=await h.post();
 assert.equal(r.status,200);
 assert.equal(h.events.some(x=>x.startsWith("UPDATE:")||x.startsWith("INSERT:")),false);
});
test("late unpaid completed event cannot reopen a failed payment",async()=>{
 const h=fixture({paymentChanges:{status:"failed"},
  sessionChanges:{payment_status:"unpaid"}}),r=await h.post();
 assert.equal(r.status,200);
 assert.equal(h.events.some(x=>x.startsWith("UPDATE:")||x.startsWith("INSERT:")),false);
});
test("conflicting failed followed by paid event needs reconciliation",async()=>{
 const h=fixture({paymentChanges:{status:"failed"}}),r=await h.post();
 assert.equal(r.status,500);
 assert.equal(h.events.some(x=>x.startsWith("UPDATE:")||x.startsWith("INSERT:")),false);
});
test("canceled payment cannot be re-opened by delayed paid checkout event",async()=>{
 const h=fixture({paymentChanges:{status:"canceled"}}),r=await h.post();
 assert.equal(r.status,500);
 assert.equal(h.events.some(x=>x.startsWith("UPDATE:")||x.startsWith("INSERT:")),false);
});
test("concurrent payment status CAS loss never sells listing or audits success",async()=>{
 const h=fixture({paymentCasLost:true}),r=await h.post();
 assert.equal(r.status,500);
 assert.ok(h.events.includes("UPDATE:payment_intents"));
 assert.ok(h.events.includes("EQ:payment_intents:status:requires_payment_method"));
 assert.equal(h.events.includes("UPDATE:listings"),false);
 assert.equal(h.events.some(x=>x.startsWith("INSERT:")),false);
});
test("concurrent listing CAS loss blocks shipment and event audit success",async()=>{
 const h=fixture({listingCasLost:true}),r=await h.post();
 assert.equal(r.status,500);
 assert.ok(h.events.includes("UPDATE:listings"));
 assert.equal(h.events.some(x=>x.startsWith("INSERT:")),false);
});
test("valid success includes seller-scoped listing write and confirms row",async()=>{
 const h=fixture(),r=await h.post();
 assert.equal(r.status,200);
 assert.ok(h.events.includes("EQ:listings:seller_id:"+SELLER));
 assert.ok(h.events.includes("UPDATE:listings"));
 assert.ok(h.events.includes("INSERT:payment_events"));
});
