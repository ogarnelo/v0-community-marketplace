import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111",SELLER="22222222-2222-4222-8222-222222222222";
function harness(opts={}){
 const calls=[],exp={};
 const listing={id:ID,title:"QA",seller_id:SELLER,school_id:ID,
  status:opts.unavailable?"archived":"available",listing_type:opts.sale?"sale":"donation",type:"donation"};
 const client={from:(table)=>{
   calls.push("FROM:"+table);
   let mode="read";
   const q={
     select:()=>q,eq:()=>q,
     maybeSingle:async()=>{
       if(table==="listings")return {data:opts.noListing?null:listing,error:opts.listingError?{message:"PRIVATE_LIST"}:null};
       if(table==="donation_requests")return {data:opts.existing?{id:ID}:null,
           error:opts.existingError?{message:"PRIVATE_EXIST"}:null};
       return {data:null,error:null};
     },
     insert:()=>{mode="insert";calls.push("INSERT:"+table);return q;},
     single:async()=>table==="donation_requests"?
       {data:opts.insertError?null:{id:ID},error:opts.insertError?{message:"PRIVATE_INS"}:null}:
       {data:opts.eventError?null:{id:ID},error:opts.eventError?{message:"PRIVATE_EVENT"}:null},
     update:()=>{mode="update";calls.push("UPDATE:"+table);return q;},
     then:(resolve,reject)=>Promise.resolve({
       error:table==="messages"&&opts.messageError?{message:"PRIVATE_MSG"}:
         table==="conversations"&&opts.touchError?{message:"PRIVATE_TOUCH"}:null
     }).then(resolve,reject)
   };
   return q;
 }};
 const mocks={
  "@/lib/marketplace/rules":{canRequestDonation:({listing})=>
   opts.invalid||listing.status!=="available"||listing.listing_type!=="donation"?
    {ok:false,error:"No permitido"}:{ok:true}},
  "@/lib/notifications":{createNotification:async()=>{
    calls.push("NOTIFY");return {error:opts.notificationError?{message:"PRIVATE_NOTIFY"}:null};
  }},
  "@/lib/donations/chat-message":{buildDonationChatBody:()=>"QA"},
  "@/lib/services/conversations.service":{getOrCreateConversation:async()=>{
    calls.push("CHAT");if(opts.chatError)throw Error("PRIVATE_CHAT");return SELLER;
  },touchConversation:async()=>{calls.push("OLD_TOUCH");}}
 };
 const content=readFileSync("lib/services/donations.service.ts","utf8");
 const compiled=ts.transpileModule(content,{fileName:"donations.service.ts",reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(compiled.outputText,{
   exports:exp,require:id=>mocks[id]??{},Date,Promise,console:{error:()=>{}}
 },{filename:"donations.service.ts",timeout:1500});
 return {calls,run:()=>exp.requestDonationFlow({supabase:client,listingId:ID,actorUserId:ID,note:"QA"})};
}
for(const [name,opts] of [
 ["anuncio no existe",{noListing:true}],
 ["falla lectura del anuncio",{listingError:true}],
 ["anuncio no disponible",{unavailable:true}],
 ["anuncio no es donación",{sale:true}],
 ["reglas rechazan",{invalid:true}],
 ["duplicado pendiente",{existing:true}],
 ["falla lectura de duplicado",{existingError:true}],
 ["falla INSERT solicitud",{insertError:true}],
]){
 test("preflight "+name+" nunca inicia conversación",async()=>{
  const h=harness(opts);await assert.rejects(h.run());
  assert.ok(!h.calls.includes("CHAT"));assert.ok(!h.calls.includes("NOTIFY"));
  if(!opts.insertError)assert.ok(!h.calls.some(x=>x.startsWith("INSERT:")));
 });
}
test("duplicado muestra nombre de error de conflicto",async()=>{
 const h=harness({existing:true});await assert.rejects(h.run(),x=>x.name==="DonationRequestConflictError");
});
test("éxito crea solicitud antes de conversación, evento, mensaje, touch y aviso",async()=>{
 const h=harness(),r=await h.run();assert.equal(r.requestId,ID);
 assert.ok(h.calls.indexOf("INSERT:donation_requests")<h.calls.indexOf("CHAT"));
 for(const c of ["INSERT:donation_request_events","INSERT:messages","UPDATE:conversations","NOTIFY"])
   assert.ok(h.calls.includes(c),c);
 assert.ok(!h.calls.includes("OLD_TOUCH"));
});
for(const [name,opts] of [
 ["falla la conversación",{chatError:true}],
 ["falla el evento",{eventError:true}],
 ["falla el mensaje",{messageError:true}],
 ["falla touch",{touchError:true}],
 ["falla la notificación",{notificationError:true}]
]){
 test("solicitud ya guardada + "+name+" => conciliación",async()=>{
  const h=harness(opts);
  await assert.rejects(h.run(),x=>x.name==="DonationRequestReconciliationError");
  assert.ok(h.calls.includes("INSERT:donation_requests"));
 });
}
test("ruta diferencia HTTP 409, 503 y errores internos",()=>{
 const s=readFileSync("app/api/donations/request/route.ts","utf8");
 assert.match(s,/DonationRequestConflictError/);assert.match(s,/status: 409/);
 assert.match(s,/DonationRequestReconciliationError/);assert.match(s,/status: 503/);
 assert.match(s,/private, no-store/);
 assert.doesNotMatch(s,/console\.error\([^)]*attributionError/);
});
test("solicitud de donación forma parte de los tests críticos",()=>{
 const pkg=JSON.parse(readFileSync("package.json","utf8"));
 assert.ok(pkg.scripts["test:pilot-security"].includes("pilot-donation-request-reconciliation-runtime.test.mjs"));
});
