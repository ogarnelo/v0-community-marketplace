import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
function setup(opts={}){
 const events=[],exp={};
 const src=readFileSync("lib/commerce/buy-now-reservation.ts","utf8");
 const transpiled=ts.transpileModule(src,{fileName:"buy-now-reservation.ts",reportDiagnostics:true,
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((transpiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(transpiled.outputText,{exports:exp,require:()=>({}),Error,Promise},
 {filename:"buy-now-reservation.ts",timeout:1800});
 const from=table=>{
  events.push("FROM:"+table);
  const filters=[],q={
   update:row=>{events.push("UPDATE:"+JSON.stringify(row));return q;},
   eq:(key,value)=>{filters.push([key,value]);return q;},
   select:cols=>{events.push("SELECT:"+cols);return q;},
   maybeSingle:async()=>{
     events.push("FILTERS:"+JSON.stringify(filters));
     return {data:opts.conflict?null:{id:ID},error:opts.error?{message:"PRIVATE_DB"}:null};
   }
  };
  return q;
 };
 return {events,reserve:(overrides={})=>exp.reserveAvailableListing({
  admin:{from},listingId:ID,expectedSellerId:"22222222-2222-4222-8222-222222222222",
  expectedPrice:15,...overrides,
 })};
}
test("atomic status CAS succeeds and confirms the listing id",async()=>{
 const h=setup(),id=await h.reserve();
 assert.equal(id,ID);
 assert.ok(h.events.includes('UPDATE:{"status":"reserved"}'));
 assert.ok(h.events.includes('FILTERS:[["id","'+ID+'"],["status","available"],["seller_id","22222222-2222-4222-8222-222222222222"],["price",15]]'));
});
test("losing reserve CAS returns 409 without provider details",async()=>{
 const h=setup({conflict:true});
 await assert.rejects(h.reserve(),e=>e.status===409&&!/PRIVATE_/.test(e.publicMessage));
 assert.equal(h.events.filter(x=>x.startsWith("UPDATE:")).length,1);
});
test("database error returns 503 without provider details",async()=>{
 const h=setup({error:true});
 await assert.rejects(h.reserve(),e=>e.status===503&&!/PRIVATE_/.test(e.publicMessage));
});
test("winner and loser isolated by UPDATE affected-row acknowledgement",async()=>{
 const winner=setup(),loser=setup({conflict:true});
 assert.equal(await winner.reserve(),ID);
 await assert.rejects(loser.reserve(),e=>e.status===409);
 assert.equal(loser.events.some(x=>x.includes("INSERT:")),false);
});
test("buy-now checks both current and globally accepted offers before attempting CAS",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 const global=s.indexOf('const { data: otherAccepted');
 const own=s.indexOf('const { data: activeOffer');
 const reserve=s.indexOf('await reserveAvailableListing');
 const chat=s.indexOf('const { data: existingConversation');
 const offer=s.indexOf('.from("listing_offers")\n        .insert');
 const payment=s.indexOf('await prepareBuyNowPaymentIntent');
 assert.ok(global>=0&&global<own&&own<reserve&&reserve<chat&&chat<offer&&offer<payment);
 assert.match(s,/listingReserved = true/);
 assert.match(s,/if \(listingReserved\)/);
});
test("buy-now forbids stale accepted-offer payment restart",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.match(s,/if \(otherAccepted\?\.id\)/);
 assert.match(s,/if \(activeOffer\?\.id\)/);
 assert.match(s,/status: 409/);
});
test("CAS loser cannot invoke new chat, accepted offer or payment in the code order",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.match(s,/if \(error instanceof BuyNowReservationError\)/);
 assert.ok(s.indexOf('if (error instanceof BuyNowReservationError)')<
 s.indexOf('const { data: existingConversation'));
 assert.match(s,/listingReserved = true/);
 assert.doesNotMatch(s,/\.upsert\(/);
});
test("purchase success and every JSON response preserve no-store",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.match(s,/Cache-Control.*private, no-store/);
 assert.match(s,/privateJson\(/);
 assert.match(s,/if \(unhideError\)/);
 assert.match(s,/if \(messageError\)/);
 assert.match(s,/if \(notifyError\)/);
});


test("post-reservation payment conflict is 503 reconciliation, never retryable 409",async()=>{
 const events=[],out={};
 const USER="22222222-2222-4222-8222-222222222222";
 const SELLER="33333333-3333-4333-8333-333333333333";
 class PaymentError extends Error {
   constructor(status,publicMessage){super(publicMessage);this.status=status;this.publicMessage=publicMessage;}
 }
 const query=(table)=>{
   const q={
     select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:()=>q,delete:()=>q,update:()=>q,
     insert:()=>{events.push("INSERT:"+table);return q;},
     maybeSingle:async()=>({
       data:table==="listings"
         ?{id:ID,title:"Test",seller_id:SELLER,school_id:null,status:"available",price:15,listing_type:"sale"}
         :table==="conversations"?{id:ID}:null,
       error:null,
     }),
     single:async()=>({data:{id:ID},error:null}),
     then:(resolve,reject)=>Promise.resolve({error:null}).then(resolve,reject),
   };
   return q;
 };
 const deps={
   "next/server":{NextResponse:{json:(body,options={})=>new Response(JSON.stringify(body),{
     status:options.status??200,headers:options.headers??{},
   })}},
   "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:{
     id:USER,user_metadata:{},email:"buyer@example.invalid",
   }},error:null})}})},
   "@/lib/supabase/admin":{createAdminClient:()=>({from:query})},
   "@/lib/payments/pricing":{buildMarketplacePricing:()=>({itemAmount:15,totalBuyerAmount:16,
     buyerFeeAmount:1,shippingAmount:0,sellerNetAmount:15,shipmentTier:"none"})},
   "@/lib/offers/chat-message":{buildOfferChatBody:()=> "test"},
   "@/lib/notifications":{createNotifications:async()=>{events.push("NOTIFICATION");return {error:null};}},
   "@/lib/marketplace/listing-type":{getListingTypeFromRow:()=> "sale"},
   "@/lib/commerce/private-access":{canUserUseCommerce:async()=>true,
     isPublicCommerceEnabled:()=>false,assertStripeTestMode:()=>{},
     isPrivateShippingLabelCreationEnabled:()=>false},
   "@/lib/analytics/product-events.server":{deferProductEvent:()=>{}},
   "@/lib/payments/safe-buy-now-intent":{BuyNowPaymentError:PaymentError,
     prepareBuyNowPaymentIntent:async()=>{events.push("PAYMENT");throw new PaymentError(409,"PAYMENT_PRIVATE_CONFLICT");}},
   "@/lib/commerce/buy-now-reservation":{BuyNowReservationError:class extends Error{},
     reserveAvailableListing:async()=>{events.push("CAS_RESERVED");return ID;}},
 };
 const src=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 const trans=ts.transpileModule(src,{fileName:"buy-now/route.ts",reportDiagnostics:true,
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 assert.equal((trans.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(trans.outputText,{exports:out,require:name=>{
   assert.ok(name in deps,"Unexpected module "+name);return deps[name];
 },Request,Response,Promise,Date,console:{error:()=>{}}},{filename:"route.js",timeout:2000});
 const response=await out.POST(new Request("https://wetudy.invalid/api/offers/buy-now",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({listingId:ID})
 }));
 const body=await response.json();
 assert.equal(response.status,503);
 assert.equal(response.headers.get("cache-control"),"private, no-store");
 assert.match(body.error,/reservado.*conciliación/);
 assert.doesNotMatch(JSON.stringify(body),/PAYMENT_PRIVATE_CONFLICT/);
 assert.ok(events.indexOf("CAS_RESERVED")>=0 && events.indexOf("CAS_RESERVED")<events.indexOf("PAYMENT"));
 assert.ok(events.includes("INSERT:listing_offers"));
 assert.equal(events.includes("NOTIFICATION"),false);
});

test("buyer reservation CAS checks price AND seller at same atomic write",async()=>{
 const h=setup(),result=await h.reserve();
 assert.equal(result,ID);
 const filters=h.events.find(event=>event.startsWith("FILTERS:"));
 assert.match(filters,/"seller_id","22222222-2222-4222-8222-222222222222"/);
 assert.match(filters,/"price",15/);
});
test("concurrent seller price change loses reservation without commerce side effects",async()=>{
 const h=setup({conflict:true});
 await assert.rejects(h.reserve(),e=>e.status===409);
 assert.ok(h.events.some(e=>e.includes('"price",15')));
 assert.equal(h.events.some(e=>/INSERT:|PAYMENT:|CONVERSATION:/.test(e)),false);
});
test("invalid price, seller or listing is rejected before DB write",async()=>{
 for(const overrides of [{expectedPrice:15.001},{expectedPrice:0},{expectedPrice:Infinity},
   {expectedPrice:1e20},{expectedSellerId:"invalid"},{listingId:"not-uuid"}]){
  const h=setup();
  await assert.rejects(h.reserve(overrides),e=>e.status===503);
  assert.equal(h.events.filter(x=>x.startsWith("FROM:")).length,0);
 }
});
test("buy-now passes preflight price and seller to guarded reservation",()=>{
 const s=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.match(s,/expectedSellerId: listing\.seller_id/);
 assert.match(s,/expectedPrice: itemAmount/);
});

test("accepted buy-now offer respects PostgreSQL current_actor CHECK (buyer/seller/NULL only)",()=>{
 const route=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 const from=route.indexOf('.from("listing_offers")\n        .insert({');
 assert.ok(from>=0,"Accepted offer INSERT must remain present");
 const end=route.indexOf("}).select",from);
 const section=end>from?route.slice(from,end):route.slice(from,from+800);
 assert.match(section,/current_actor:\s*null/);
 assert.match(section,/status:\s*"accepted"/);
 assert.doesNotMatch(section,/current_actor:\s*"closed"/);
});
test("offer chat body may still describe a closed turn without violating SQL actor enum",()=>{
 const route=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.match(route,/currentActor:\s*"closed"/);
 assert.match(route,/current_actor:\s*null/);
});
