import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const OWNER="22222222-2222-4222-8222-222222222222";
function invoke({flag,accountType="parent",role="guardian",rpcResult=true,rpcError=false}){
  const calls=[];
  const context={id:ID,relationship:role,active:true,is_primary:false};
  function query(table){
    let kind="read";
    const q={select:()=>q,eq:()=>q,update:()=>{kind="update";calls.push("legacy_update");return q;},
      maybeSingle:async()=>{if(table==="profiles")return {data:{user_type:accountType},error:null};
        return {data:context,error:null}},
      then(resolve){return Promise.resolve({data:null,error:null}).then(resolve)}
    };return q;
  }
  const client={from:query,rpc:async(name,args)=>{
    calls.push("rpc");
    assert.equal(name,"r2_deactivate_student_and_promote_candidate");
    assert.equal(args.p_owner_user_id,OWNER);
    assert.equal(args.p_student_id,ID);
    return {data:rpcResult,error:rpcError?{message:"PRIVATE_DB_MESSAGE"}:null};
  }};
  const code=ts.transpileModule(readFileSync("lib/account-students/server.ts","utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const exports={};
  vm.runInNewContext(code,{
    exports,require:source=>source==="@/lib/supabase/admin"?{createAdminClient:()=>client}:{},
    Date,Error,console,process:{env:{WETUDY_R2_STUDENT_ATOMIC_DEACTIVATE_ENABLED:flag?"true":"false"}}
  });
  return {calls,run:()=>exports.deactivateAccountStudent(OWNER,ID)};
}
test("OFF: leaves existing path intact, never invokes missing RPC",async()=>{
 const h=invoke({flag:false});await h.run();assert.equal(h.calls.includes("rpc"),false);assert.equal(h.calls.includes("legacy_update"),true);
});
test("ON: confirms atomic operation without any legacy writes",async()=>{
 const h=invoke({flag:true});const r=await h.run();assert.equal(r.id,ID);
 assert.deepEqual(h.calls,["rpc"]);
});
test("ON: failed RPC refuses fallback and sanitizes DB detail",async()=>{
 const h=invoke({flag:true,rpcError:true});
 await assert.rejects(h.run(),e=>e.status===503&&e.code==="atomic_deactivation_unavailable"&&!e.message.includes("PRIVATE_DB_MESSAGE"));
 assert.deepEqual(h.calls,["rpc"]);
});
test("ON: revoked/stale context refuses fallback",async()=>{
 const h=invoke({flag:true,rpcResult:false});await assert.rejects(h.run(),e=>e.status===409&&e.code==="student_state_changed");
 assert.deepEqual(h.calls,["rpc"]);
});
test("ON: student self-deletion never calls atomic RPC",async()=>{
 const h=invoke({flag:true,accountType:"student",role:"self"});
 await assert.rejects(h.run(),e=>e.status===409&&e.code==="self_context_required");
 assert.equal(h.calls.includes("rpc"),false);
});
test("ON: stale relationship never invokes privileged RPC",async()=>{
 const h=invoke({flag:true,accountType:"parent",role:"self"});
 await assert.rejects(h.run(),e=>e.status===409&&e.code==="relationship_mismatch");
 assert.equal(h.calls.includes("rpc"),false);
});
