import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const U="11111111-1111-4111-8111-111111111111";
const SELLER="22222222-2222-4222-8222-222222222222";
function setup(opts={}){
 const calls=[],exp={};
 const listing={id:U,title:"QA",seller_id:SELLER,status:"available",listing_type:"sale",type:"sale"};
 function table(name){
  const q={select:()=>q,eq:()=>q,in:()=>q,
   maybeSingle:async()=>{
    if(name==="listings")return {data:opts.noListing?null:listing,error:null};
    if(name==="listing_offers")return {data:opts.existing?{id:U}:null,
      error:opts.existingReadError?{message:"PRIVATE_SQL"}:null};
    if(name==="conversations"&&opts.noTouch)return {data:null,error:null};
    return {data:{id:U},error:null};
   },
   insert:row=>{calls.push("INSERT:"+name);q.inserted=row;return q;},
   single:async()=>{
    if(name==="listing_offers")return {
      data:opts.unique||opts.insertError?null:{id:U},
      error:opts.unique?{code:"23505",message:"PRIVATE_CONFLICT"}:
        opts.insertError?{message:"PRIVATE_SQL"}:null};
    if(name==="listing_offer_events")return {
      data:opts.eventError?null:{id:U},
      error:opts.eventError?{message:"PRIVATE_EVENT_SQL"}:null};
    return {data:{id:U},error:null};
   },
   update:()=>{calls.push("UPDATE:"+name);return q;},
   then:(resolve,reject)=>Promise.resolve({
     error:name==="messages"&&opts.messageError?{message:"PRIVATE_MESSAGE"}:null
   }).then(resolve,reject)};
  return q;
 }
 const mocks={
  "@/lib/offers/chat-message":{buildOfferChatBody:()=>"QA"},
  "@/lib/marketplace/rules":{MAX_OFFER_ROUNDS:10,canCreateOffer:()=>({ok:true}),canRespondToOfferTurn:()=>({ok:true})},
  "@/lib/notifications":{createNotification:async()=>{
   calls.push("NOTIFY");return {error:opts.notifyError?{message:"PRIVATE_NOTIF"}:null};
  }},
  "@/lib/services/conversations.service":{
   getOrCreateConversation:async()=>{
    calls.push("CHAT");if(opts.chatError)throw Error("PRIVATE_CHAT");
    return U;
   },touchConversation:async()=>{calls.push("LEGACY_TOUCH");}
  }
 };
 const src=readFileSync("lib/services/offers.service.ts","utf8");
 const compiled=ts.transpileModule(src,{fileName:"offers.service.ts",reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(compiled.outputText,{
  exports:exp,require:id=>mocks[id]??{},Date,Promise,console:{error:()=>{}}
 },{filename:"offers.service.ts",timeout:1800});
 return {calls,run:()=>exp.createOfferFlow({supabase:{from:table},listingId:U,offeredPrice:12.34,actorUserId:U})};
}
test("negociación activa devuelve conversación real en vez de variable sin inicializar",async()=>{
 const h=setup({existing:true}),result=await h.run();
 assert.equal(result.alreadyExists,true);
 assert.equal(result.conversationId,U);
 assert.equal(result.offerId,U);
 assert.ok(h.calls.includes("CHAT"));
 assert.equal(h.calls.some(x=>x.startsWith("INSERT:")),false);
});
for(const [scenario,config] of [
 ["error consultando existentes",{existingReadError:true}],
 ["anuncio inexistente",{noListing:true}],
 ["único 23505",{unique:true}],
 ["otro error de inserción",{insertError:true}]
]){
 test(scenario+" no crea chat ni notificaciones",async()=>{
  const h=setup(config);await assert.rejects(h.run());
  assert.equal(h.calls.includes("CHAT"),false);
  assert.equal(h.calls.includes("NOTIFY"),false);
 });
}
test("índice UNIQUE 23505 se mapea a conflicto tipado",async()=>{
 const h=setup({unique:true});
 await assert.rejects(h.run(),e=>e.name==="OfferCreationConflictError");
});
test("creación válida registra evento, mensaje, touch y aviso",async()=>{
 const h=setup(),result=await h.run();
 assert.equal(result.offerId,U);assert.equal(result.conversationId,U);
 for(const event of ["CHAT","INSERT:listing_offers","INSERT:listing_offer_events",
  "INSERT:messages","UPDATE:conversations","NOTIFY"])
 assert.ok(h.calls.includes(event),event);
 assert.ok(h.calls.indexOf("INSERT:listing_offers")<h.calls.indexOf("CHAT"));
 assert.ok(!h.calls.includes("LEGACY_TOUCH"));
});
for(const [scenario,config] of [
 ["chat falla",{chatError:true}],
 ["evento falla",{eventError:true}],
 ["mensaje falla",{messageError:true}],
 ["notificación falla",{notifyError:true}],
 ["touch sin fila",{noTouch:true}]
]){
 test("oferta persistida, "+scenario+" => conciliación",async()=>{
  const h=setup(config);
  await assert.rejects(h.run(),e=>e.name==="OfferSideEffectReconciliationError");
  assert.ok(h.calls.includes("INSERT:listing_offers"));
  if(config.eventError||config.messageError||config.noTouch)assert.equal(h.calls.includes("NOTIFY"),false);
 });
}
test("API mapea sin eco interno los errores 409 y 503 y mantiene feature gate",()=>{
 const route=readFileSync("app/api/offers/create/route.ts","utf8");
 assert.match(route,/OfferCreationConflictError/);
 assert.match(route,/OfferSideEffectReconciliationError/);
 assert.match(route,/status: 409/);
 assert.match(route,/status: 503/);
 assert.match(route,/private, no-store/);
 assert.match(route,/isLegacyCommerceEnabled/);
});
