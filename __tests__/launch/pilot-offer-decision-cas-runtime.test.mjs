import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const SELLER="22222222-2222-4222-8222-222222222222";
const offer={id:ID,listing_id:ID,buyer_id:ID,seller_id:SELLER,
 offered_price:20,current_amount:20,current_actor:"seller",rounds_count:1,status:"pending"};
function runtime(opts={}){
 const calls=[],exp={};
 const mocks={
  "@/lib/offers/chat-message":{buildOfferChatBody:()=> "message"},
  "@/lib/marketplace/rules":{MAX_OFFER_ROUNDS:10,canCreateOffer:()=>({ok:true}),canRespondToOfferTurn:()=>({ok:true})},
  "@/lib/notifications":{createNotification:async()=>{
    calls.push("NOTIFY");return {error:opts.notifyError?{message:"PRIVATE_NOTIFY"}:null};
  }},
  "@/lib/services/conversations.service":{getOrCreateConversation:async()=>{
    calls.push("CHAT");if(opts.chatError)throw Error("PRIVATE_CHAT");return ID;
  }}
 };
 function from(table){
   const state={op:"read",filters:[]};
   calls.push("FROM:"+table);
   const q={
    select:()=>q,eq:(k,v)=>{state.filters.push([k,v]);return q;},
    neq:()=>q,in:()=>q,
    maybeSingle:async()=>{
      if(state.op==="write"){
        if(table==="listing_offers"){
          calls.push("CAS:"+JSON.stringify(state.filters));
          return {data:opts.race?null:{id:ID},error:opts.writeError?{message:"PRIVATE_WRITE"}:null};
        }
        if(table==="listings")return {data:opts.reserveMissing?null:{id:ID},
          error:opts.reserveError?{message:"PRIVATE_RESERVE"}:null};
        if(table==="conversations")return {data:opts.touchMissing?null:{id:ID},
          error:opts.touchError?{message:"PRIVATE_TOUCH"}:null};
      }
      if(table==="listing_offers")return {data:{...offer},error:opts.readError?{message:"PRIVATE_READ"}:null};
      if(table==="listings")return {data:{id:ID,title:"QA",status:opts.unavailable?"archived":"available"},error:null};
      return {data:{id:ID},error:null};
    },
    update:()=>{state.op="write";calls.push("UPDATE:"+table);return q;},
    insert:()=>{state.op="insert";calls.push("INSERT:"+table);return q;},
    single:async()=>({data:opts.eventError?null:{id:ID},
     error:opts.eventError?{message:"PRIVATE_EVENT"}:null}),
    then:(resolve,reject)=>Promise.resolve({error:
      table==="messages"&&opts.messageError?{message:"PRIVATE_MESSAGE"}:
      table==="listing_offers"&&state.op==="write"&&opts.competitorError?{message:"PRIVATE_COMPETITOR"}:null
    }).then(resolve,reject)
   };
   return q;
 }
 const source=readFileSync("lib/services/offers.service.ts","utf8");
 const comp=ts.transpileModule(source,{fileName:"offers.service.ts",reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((comp.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(comp.outputText,{exports:exp,require:x=>mocks[x]??{},Date,Promise,Number,
  console:{error:()=>{}}},{filename:"offers.service.ts",timeout:1700});
 return {calls,run:(action)=>exp.respondToOfferFlow({
   supabase:{from},offerId:ID,action,actorUserId:SELLER,
   ...(action==="counter"?{counterPrice:24}: {})
 })};
}
for(const action of ["accept","reject","counter"]){
 test(action+" stale CAS => 409 typed, no chat",async()=>{
  const h=runtime({race:true});
  await assert.rejects(h.run(action),e=>e.name=== (action==="accept" ? "OfferSideEffectReconciliationError" : "OfferDecisionConflictError"));
  assert.equal(h.calls.includes("CHAT"),false);
  assert.equal(h.calls.includes("NOTIFY"),false);
  const cas=h.calls.find(x=>x.startsWith("CAS:"));
  assert.match(cas,/"status","pending"/);
  assert.match(cas,/"rounds_count",1/);
 });
 test(action+" database write error has no chat",async()=>{
  const h=runtime({writeError:true});await assert.rejects(h.run(action));
  assert.equal(h.calls.includes("CHAT"),false);
 });
 test(action+" valid, confirms event/message/touch/notification",async()=>{
  const h=runtime(),out=await h.run(action);
  assert.equal(out.conversationId,ID);
  for(const name of ["CHAT","INSERT:listing_offer_events","INSERT:messages","UPDATE:conversations","NOTIFY"])
    assert.ok(h.calls.includes(name),name);
  assert.ok(h.calls.indexOf("UPDATE:listing_offers")<h.calls.indexOf("CHAT"));
 });
 for(const [label,opts] of [
  ["event fail",{eventError:true}],
  ["message fail",{messageError:true}],
  ["touch fail",{touchError:true}],
  ["notification fail",{notifyError:true}]
 ]){
  test(action+" "+label+" => reconcile",async()=>{
   const h=runtime(opts);await assert.rejects(h.run(action),e=>e.name==="OfferSideEffectReconciliationError");
  });
 }
}
test("accept cannot proceed with unavailable listing",async()=>{
 const h=runtime({unavailable:true});
 await assert.rejects(h.run("accept"),e=>e.name==="OfferDecisionConflictError");
 assert.equal(h.calls.includes("CHAT"),false);
});
test("counter cannot proceed with unavailable listing",async()=>{
 const h=runtime({unavailable:true});
 await assert.rejects(h.run("counter"),e=>e.name==="OfferDecisionConflictError");
});
test("failed reservation BEFORE accepted CAS is conflict without offer update",async()=>{
 const h=runtime({reserveMissing:true});
 await assert.rejects(h.run("accept"),e=>e.name==="OfferDecisionConflictError");
 assert.equal(h.calls.includes("UPDATE:listing_offers"),false);
 assert.equal(h.calls.includes("CHAT"),false);
});
test("route 409 conflict, 503 reconciliation, legacy gate unchanged",()=>{
 const r=readFileSync("app/api/offers/respond/route.ts","utf8");
 assert.match(r,/OfferDecisionConflictError/);
 assert.match(r,/OfferSideEffectReconciliationError/);
 assert.match(r,/status: 409/);
 assert.match(r,/status: 503/);
 assert.match(r,/private, no-store/);
 assert.match(r,/isLegacyCommerceEnabled/);
});
