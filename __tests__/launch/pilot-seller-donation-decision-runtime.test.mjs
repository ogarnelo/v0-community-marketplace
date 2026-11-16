import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const U="11111111-1111-4111-8111-111111111111", OTHER="22222222-2222-4222-8222-222222222222";
function runtime(opts={}){
  const calls=[],exp={},req={
    id:U,listing_id:U,requester_id:OTHER,school_id:U,status:opts.status??"pending"
  };
  const listing={
    id:U,school_id:opts.otherSchool?OTHER:U,seller_id:opts.notSeller?OTHER:U,
    title:"Donación QA",status:opts.listingStatus??"available"
  };
  const q=(table)=>{
    const state={mode:"read",eqs:[]};
    const chain={
      select:()=>chain,eq:(k,v)=>{state.eqs.push([k,v]);return chain;},
      neq:()=>chain,limit:()=>chain,
      update:(data)=>{calls.push("UPDATE:"+table+":"+String(data.status));state.mode="update";return chain;},
      insert:(data)=>{calls.push("INSERT:"+table);state.mode="insert";return chain;},
      maybeSingle:async()=>{
        if(state.mode==="update"){
          if(table==="donation_requests" && state.eqs.some(([k,v])=>k==="id"&&v===U)){
            calls.push("CAS:"+JSON.stringify(state.eqs));
            return {data:opts.race?null:{id:U},
                    error:opts.casError?{message:"PRIVATE_SQL_CAS"}:null};
          }
          if(table==="listings")return {data:opts.archiveMissing?null:{id:U},
            error:opts.archiveError?{message:"PRIVATE_SQL_ARCHIVE"}:null};
          if(table==="conversations")return {data:opts.touchMissing?null:{id:U},
            error:opts.touchError?{message:"PRIVATE_SQL_TOUCH"}:null};
        }
        if(table==="donation_requests"){
          if(state.eqs.some(([k,v])=>k==="status"&&v==="approved")){
            return {data:opts.winner?{id:OTHER}:null,error:opts.winnerError?{message:"PRIVATE_SQL_WINNER"}:null};
          }
          return {data:opts.noRequest?null:req,error:opts.reqError?{message:"PRIVATE_SQL_REQ"}:null};
        }
        if(table==="listings")return {data:opts.noListing?null:listing,
          error:opts.listingError?{message:"PRIVATE_SQL_LIST"}:null};
        return {data:null,error:null};
      },
      single:async()=>({data:opts.eventError?null:{id:U},error:opts.eventError?{message:"PRIVATE_SQL_EVENT"}:null}),
      then:(resolve,reject)=>Promise.resolve({
        error:opts.competitorError&&state.mode==="update"&&table==="donation_requests"?
          {message:"PRIVATE_COMPETITOR"}:null
      }).then(resolve,reject),
    };
    if(table==="messages"){
      chain.insert=async()=>{calls.push("INSERT:messages");return {
        error:opts.messageError?{message:"PRIVATE_SQL_MESSAGE"}:null};};
    }
    return chain;
  };
  const db={from:name=>{calls.push("FROM:"+name);return q(name)}};
  const mocks={
    "@/lib/marketplace/rules":{canRequestDonation:()=>({ok:true})},
    "@/lib/notifications":{createNotification:async()=>{
      calls.push("NOTIFY");return {error:opts.notificationError?{message:"PRIVATE_NOTIFY"}:null};
    }},
    "@/lib/donations/chat-message":{buildDonationChatBody:()=>"mensaje sintético"},
    "@/lib/services/conversations.service":{
      getOrCreateConversation:async()=>{
        calls.push("CONVERSATION");
        if(opts.conversationError)throw Error("PRIVATE_CONVERSATION");
        return U;
      },
      touchConversation:async()=>{calls.push("TOUCH");}
    }
  };
  const source=readFileSync("lib/services/donations.service.ts","utf8");
  const comp=ts.transpileModule(source,{fileName:"donations.service.ts",reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
  assert.equal((comp.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  vm.runInNewContext(comp.outputText,{
    exports:exp,require:name=>mocks[name]??{},Date,Promise,console:{error:()=>{}}
  },{filename:"donations.service.ts",timeout:1500});
  return {calls,run:(action="accept")=>exp.respondToDonationFlow({
    supabase:db,requestId:U,action,actorUserId:U
  })};
}
for(const [label,opts] of [
 ["solicitud inexistente",{noRequest:true}],
 ["lectura de solicitud fallida",{reqError:true}],
 ["solicitud ya revisada",{status:"approved"}],
 ["sin titularidad de vendedor",{notSeller:true}],
 ["escuela distinta",{otherSchool:true}],
 ["lectura de anuncio fallida",{listingError:true}],
 ["anuncio no disponible",{listingStatus:"archived"}],
 ["solicitud ya aprobada por otro",{winner:true}],
 ["consulta del ganador anterior fallida",{winnerError:true}],
]){
 test("preflight: "+label+" no crea efectos",async()=>{
  const h=runtime(opts);await assert.rejects(h.run());
  assert.equal(h.calls.some(x=>x.startsWith("UPDATE:")),false);
  assert.equal(h.calls.includes("CONVERSATION"),false);
  assert.equal(h.calls.includes("NOTIFY"),false);
 });
}
for(const action of ["accept","reject"]){
 test(action+" con carrera de estado: CAS rechaza sin crear chat",async()=>{
  const h=runtime({race:true});await assert.rejects(h.run(action),
    e=>e.name==="DonationDecisionConflictError");
  assert.equal(h.calls.includes("CONVERSATION"),false);
  assert.equal(h.calls.includes("NOTIFY"),false);
  const cas=h.calls.find(x=>x.startsWith("CAS:"));
  assert.ok(cas&&cas.includes('"status","pending"'));
 });
 test(action+" con SQL error: no hay efectos posteriores",async()=>{
  const h=runtime({casError:true});await assert.rejects(h.run(action));
  assert.equal(h.calls.includes("CONVERSATION"),false);
  assert.equal(h.calls.includes("NOTIFY"),false);
 });
 test(action+" válido: registra decisión, evento, mensaje y notificación",async()=>{
  const h=runtime(),r=await h.run(action);
  assert.equal(r.conversationId,U);
  assert.ok(h.calls.includes("CONVERSATION"));
  assert.ok(h.calls.includes("INSERT:donation_request_events"));
  assert.ok(h.calls.includes("INSERT:messages"));
  assert.ok(h.calls.includes("NOTIFY"));
 });
 test(action+" con fallo de conversación: exige conciliación",async()=>{
  const h=runtime({conversationError:true});
  await assert.rejects(h.run(action),e=>e.name==="DonationDecisionReconciliationError");
  assert.equal(h.calls.includes("NOTIFY"),false);
 });
 test(action+" con fallo evento: exige conciliación",async()=>{
  const h=runtime({eventError:true});
  await assert.rejects(h.run(action),e=>e.name==="DonationDecisionReconciliationError");
  assert.equal(h.calls.includes("NOTIFY"),false);
 });
 test(action+" con fallo mensaje: exige conciliación",async()=>{
  const h=runtime({messageError:true});
  await assert.rejects(h.run(action),e=>e.name==="DonationDecisionReconciliationError");
  assert.equal(h.calls.includes("NOTIFY"),false);
 });
 test(action+" con fallo notificación: exige conciliación",async()=>{
  const h=runtime({notificationError:true});
  await assert.rejects(h.run(action),e=>e.name==="DonationDecisionReconciliationError");
 });
}
for(const action of ["accept","reject"]){
 for(const scenario of [{touchError:true},{touchMissing:true}]){
  test(action+" · conversación no confirmada => conciliación sin notificar",async()=>{
   const h=runtime(scenario);
   await assert.rejects(h.run(action),e=>e.name==="DonationDecisionReconciliationError");
   assert.ok(h.calls.some(x=>x.startsWith("UPDATE:conversations:")));
   assert.equal(h.calls.includes("NOTIFY"),false);
  });
 }
}
for(const config of [{archiveError:true},{archiveMissing:true},{competitorError:true}]){
 test("aceptación: "+JSON.stringify(config)+" exige conciliación",async()=>{
   const h=runtime(config);
   await assert.rejects(h.run(),e=>e.name==="DonationDecisionReconciliationError");
   assert.equal(h.calls.includes("NOTIFY"),false);
 });
}
test("rechazar sigue permitido tras archivado del anuncio sin volver a aprobar",async()=>{
 const h=runtime({listingStatus:"archived"});const x=await h.run("reject");
 assert.equal(x.conversationId,U);
});
test("la ruta expone solo estados 409/503 genéricos y no-store",()=>{
 const text=readFileSync("app/api/donations/respond/route.ts","utf8");
 assert.match(text,/DonationDecisionConflictError/);
 assert.match(text,/DonationDecisionReconciliationError/);
 assert.match(text,/status: 409/);
 assert.match(text,/status: 503/);
 assert.match(text,/private, no-store/);
});
