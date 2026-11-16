import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const U="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const S="33333333-3333-4333-8333-333333333333";
function setup(opt={}){
 const calls=[],out={};
 let findCount=0;
 const from=(table)=>{
  const state={op:"lookup"};
  const q={
    select:()=>q,eq:(k,v)=>{calls.push("EQ:"+table+":"+k+":"+v);return q;},
    in:(k,arr)=>{calls.push("IN:"+table+":"+k+":"+arr.join(","));return q;},
    insert:row=>{state.op="insert";calls.push("INSERT:"+table);return q;},
    update:row=>{state.op="update";calls.push("UPDATE:"+table);return q;},
    delete:()=>{state.op="delete";calls.push("DELETE:"+table);return q;},
    maybeSingle:async()=>{
      if(table==="conversations"&&state.op==="update"){
        return {data:opt.touchMissing?null:{id:U},
          error:opt.touchError?{message:"PRIVATE_UPDATE_SQL"}:null};
      }
      if(table==="conversations"){
        findCount++;
        if(opt.initialReadError&&findCount===1) return {data:null,error:{message:"PRIVATE_SELECT_SQL"}};
        if(findCount===1) return {data:opt.existing?{id:U}:null,error:null};
        return {data:opt.raceWinnerMissing?null:{id:U},
          error:opt.raceWinnerError?{message:"PRIVATE_RESELECT_SQL"}:null};
      }
      return {data:null,error:null};
    },
    single:async()=>({data:opt.uniqueRace||opt.insertError?null:{id:U},
       error:opt.uniqueRace?{code:"23505",message:"PRIVATE_UNIQUE"}:
         opt.insertError?{message:"PRIVATE_INSERT_SQL"}:null}),
    then:(resolve,reject)=>Promise.resolve({
      error:state.op==="delete"&&opt.unhideError?{message:"PRIVATE_UNHIDE_SQL"}:null
    }).then(resolve,reject)
  };
  calls.push("FROM:"+table);
  return q;
 };
 const source=readFileSync("lib/services/conversations.service.ts","utf8");
 const compiled=ts.transpileModule(source,{fileName:"conversations.service.ts",reportDiagnostics:true,
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(compiled.outputText,{
   exports:out,require:module=>module==="@/lib/analytics/product-events.server"?
      {deferProductEvent:()=>calls.push("ANALYTICS")}:{},
   Date,Promise,console:{error:()=>{}}
 },{filename:"conversations.service.ts",timeout:1600});
 return {calls,open:()=>out.getOrCreateConversation({supabase:{from},listingId:U,buyerId:B,sellerId:S}),
   touch:(id=U)=>out.touchConversation({from},id,"2026-11-17T00:00:00Z")};
}
test("chat existente: reuso exacto y desocultación, sin INSERT",async()=>{
 const h=setup({existing:true}),id=await h.open();
 assert.equal(id,U);
 assert.equal(h.calls.includes("INSERT:conversations"),false);
 assert.ok(h.calls.includes("DELETE:hidden_conversations"));
 assert.ok(h.calls.includes("IN:hidden_conversations:user_id:"+B+","+S));
 assert.equal(h.calls.includes("ANALYTICS"),false);
});
test("chat nuevo: INSERT y analítica solo una vez, restaura visibilidad",async()=>{
 const h=setup(),id=await h.open();
 assert.equal(id,U);assert.ok(h.calls.includes("INSERT:conversations"));
 assert.ok(h.calls.includes("DELETE:hidden_conversations"));
 assert.equal(h.calls.filter(x=>x==="ANALYTICS").length,1);
});
test("error SELECT anterior al INSERT detiene efectos",async()=>{
 const h=setup({initialReadError:true});await assert.rejects(h.open());
 assert.equal(h.calls.includes("INSERT:conversations"),false);
 assert.equal(h.calls.includes("DELETE:hidden_conversations"),false);
});
test("error INSERT ordinario nunca se expresa como éxito",async()=>{
 const h=setup({insertError:true});await assert.rejects(h.open());
 assert.equal(h.calls.includes("DELETE:hidden_conversations"),false);
});
test("carrera UNIQUE 23505 recupera chat ganador sin duplicados",async()=>{
 const h=setup({uniqueRace:true}),id=await h.open();
 assert.equal(id,U);
 assert.equal(h.calls.filter(x=>x==="INSERT:conversations").length,1);
 assert.equal(h.calls.filter(x=>x==="FROM:conversations").length,3);
 assert.equal(h.calls.includes("ANALYTICS"),false);
 assert.ok(h.calls.includes("DELETE:hidden_conversations"));
});
for(const [name,options] of [
 ["race sin fila ganadora",{uniqueRace:true,raceWinnerMissing:true}],
 ["race con error de relectura",{uniqueRace:true,raceWinnerError:true}]
]){
 test(name+" falla seguro, no desoculta fila desconocida",async()=>{
  const h=setup(options);await assert.rejects(h.open());
  assert.equal(h.calls.includes("DELETE:hidden_conversations"),false);
  assert.equal(h.calls.includes("ANALYTICS"),false);
 });
}
for(const options of [{existing:true,unhideError:true},{unhideError:true},{uniqueRace:true,unhideError:true}]){
 test("fallo de unhide "+JSON.stringify(options)+" requiere conciliación",async()=>{
  const h=setup(options);
  await assert.rejects(h.open(),e=>!String(e.message).includes("PRIVATE_"));
  assert.ok(h.calls.includes("DELETE:hidden_conversations"));
 });
}
test("touch: con conversación nula no hay escrituras",async()=>{
 const h=setup();await h.touch(null);assert.equal(h.calls.includes("UPDATE:conversations"),false);
});
test("touch: éxito confirma fila realmente actualizada",async()=>{
 const h=setup();await h.touch();assert.ok(h.calls.includes("UPDATE:conversations"));
});
for(const options of [{touchError:true},{touchMissing:true}]){
 test("touch "+JSON.stringify(options)+" no ignora error o cero filas",async()=>{
  const h=setup(options);await assert.rejects(h.touch(),e=>!String(e.message).includes("PRIVATE_"));
 });
}
test("no hay mensajes SQL privados en errores y existen guardas de consulta repetida",()=>{
 const s=readFileSync("lib/services/conversations.service.ts","utf8");
 assert.match(s,/newConversationError\?\.code === "23505"/);
 assert.match(s,/if \(unhideError\)/);
 assert.match(s,/if \(touchError \|\| !touched\)/);
 assert.doesNotMatch(s,/throw new Error\(.*\.message/);
});
