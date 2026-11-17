import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111",SELLER="22222222-2222-4222-8222-222222222222";
function runtime(options={}){
 const calls=[],exports={};
 const mocks={
  "@/lib/offers/chat-message":{buildOfferChatBody:()=>"mock"},
  "@/lib/marketplace/rules":{MAX_OFFER_ROUNDS:10,canCreateOffer:()=>({ok:true}),canRespondToOfferTurn:()=>({ok:true})},
  "@/lib/notifications":{createNotification:async()=>({error:null})},
  "@/lib/services/conversations.service":{getOrCreateConversation:async()=>{calls.push("CHAT");return ID;}}
 };
 const from=table=>{
  const q={state:"read",filters:[],
   select:()=>q,
   eq:(k,v)=>{q.filters.push([k,v]);return q;},
   neq:()=>q,in:()=>q,
   update:(value)=>{q.state="write";calls.push("UPDATE:"+table+":"+value.status);return q;},
   insert:()=>{q.state="insert";calls.push("INSERT:"+table);return q;},
   maybeSingle:async()=>{
    if(q.state==="write"){
      if(table==="listings")return {data:options.reserveLose?null:{id:ID},
       error:options.reserveSql?{message:"PRIVATE_RESERVE"}:null};
      if(table==="listing_offers"){
       calls.push("OFFER_CAS:"+JSON.stringify(q.filters));
       return {data:options.offerLose?null:{id:ID},
         error:options.offerSql?{message:"PRIVATE_OFFER_SQL"}:null};
      }
      return {data:{id:ID},error:null};
    }
    if(table==="listing_offers")return {data:{id:ID,listing_id:ID,buyer_id:ID,seller_id:SELLER,
     offered_price:20,current_amount:20,current_actor:"seller",rounds_count:1,status:"pending"},error:null};
    if(table==="listings")return {data:{id:ID,title:"Fixture",status:"available"},error:null};
    return {data:{id:ID},error:null};
   },
   single:async()=>({data:{id:ID},error:null}),
   then:(resolve,reject)=>Promise.resolve({error:null}).then(resolve,reject)
  };
  return q;
 };
 const src=readFileSync("lib/services/offers.service.ts","utf8");
 const compiled=ts.transpileModule(src,{reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(compiled.outputText,{exports,require:k=>mocks[k]??{},Date,Promise,Number},
 {filename:"offers.service.ts",timeout:1800});
 return {calls,run:(action)=>exports.respondToOfferFlow({supabase:{from},offerId:ID,
   action,actorUserId:SELLER,counterPrice:24})};
}
test("accept reserves listing before accepting offer; remains private operation",async()=>{
 const h=runtime();await h.run("accept");
 const reserve=h.calls.findIndex(x=>x==="UPDATE:listings:reserved");
 const offer=h.calls.findIndex(x=>x==="UPDATE:listing_offers:accepted");
 assert.ok(reserve>=0&&offer>reserve);
 assert.ok(h.calls.indexOf("CHAT")>offer);
});
for(const [scenario,options] of [["another buyer won",{reserveLose:true}],
 ["reservation SQL failed",{reserveSql:true}]]){
 test(scenario+" => no accepted offer, no chat",async()=>{
  const h=runtime(options);
  await assert.rejects(h.run("accept"),e=>options.reserveLose?
    e.name==="OfferDecisionConflictError":e.name!=="OfferDecisionConflictError");
  assert.equal(h.calls.some(x=>x.startsWith("UPDATE:listing_offers")),false);
  assert.equal(h.calls.includes("CHAT"),false);
 });
}
for(const [scenario,options] of [["stale status",{offerLose:true}],
 ["offer SQL failed",{offerSql:true}]]){
 test("reservation won then "+scenario+" => reconciliation, never 409",async()=>{
  const h=runtime(options);
  await assert.rejects(h.run("accept"),e=>e.name==="OfferSideEffectReconciliationError");
  assert.ok(h.calls.includes("UPDATE:listings:reserved"));
  assert.equal(h.calls.includes("CHAT"),false);
 });
}
for(const action of ["reject","counter"]){
 test(action+" does not reserve listing",async()=>{
  const h=runtime();await h.run(action);
  assert.equal(h.calls.includes("UPDATE:listings:reserved"),false);
 });
}
test("buy-now and offer acceptance share availability status CAS field names",()=>{
 const s=readFileSync("lib/services/offers.service.ts","utf8");
 const b=readFileSync("lib/commerce/buy-now-reservation.ts","utf8");
 for(const input of [s,b]){
   assert.match(input,/update\(\{ status: "reserved" \}\)/);
   assert.match(input,/eq\("status", "available"\)/);
   assert.match(input,/select\("id"\)\s*\.maybeSingle\(\)/);
 }
});
test("both route guards stay closed and response offers no automated compensating unlock",()=>{
 const s=readFileSync("app/api/offers/respond/route.ts","utf8");
 const b=readFileSync("app/api/offers/buy-now/route.ts","utf8");
 assert.match(s,/isLegacyCommerceEnabled/);
 assert.match(b,/canUserUseCommerce/);
 assert.doesNotMatch(readFileSync("lib/services/offers.service.ts","utf8"),
  /update\(\{\s*status:\s*"available"\s*\}\)/);
});
