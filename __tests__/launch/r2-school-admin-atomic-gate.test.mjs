import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const USER="11111111-1111-4111-8111-111111111111";
const SCHOOL="22222222-2222-4222-8222-222222222222";
function fixture({flag=true,error=false,approved=true,canary=USER}={}){
 const calls=[],exports={};
 const admin={
  rpc:async(name,args)=>{
   calls.push("RPC");
   assert.equal(name,"r2_grant_school_admin_atomic_candidate");
   assert.equal(args.p_user_id,USER);
   assert.equal(args.p_school_id,SCHOOL);
   return {data:approved,error:error?{message:"SENSITIVE_DB_ERROR"}:null};
  },
  from:()=>{calls.push("LEGACY_DB");throw Error("unexpected legacy DB query");}
 };
 const js=ts.transpileModule(readFileSync("lib/admin/school-admin-role.ts","utf8"),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 vm.runInNewContext(js,{exports,require:k=>k==="@/lib/supabase/admin"?{createAdminClient:()=>admin}:{},
  Promise,Error,process:{env:{WETUDY_R2_SCHOOL_ADMIN_ATOMIC_GRANT_ENABLED:flag?"true":"false",WETUDY_R2_SCHOOL_ADMIN_ATOMIC_GRANT_CANARY_USER_IDS:canary}}});
 return {calls,grant:()=>exports.grantSchoolAdminRole({userId:USER,schoolId:SCHOOL})};
}
test("ON grant succeeds with exactly one RPC and zero legacy writes",async()=>{
 const f=fixture();await f.grant();assert.deepEqual(f.calls,["RPC"]);
});
test("ON rejects an unauthorized/invalid target without any fallback",async()=>{
 const f=fixture({approved:false});
 await assert.rejects(f.grant(),/No se pudo autorizar el colegio/);
 assert.deepEqual(f.calls,["RPC"]);
});
test("ON handles absent RPC or DB errors without leaking details or fallback",async()=>{
 const f=fixture({error:true});
 await assert.rejects(f.grant(),e=>!e.message.includes("SENSITIVE_DB_ERROR"));
 assert.deepEqual(f.calls,["RPC"]);
});

for(const [description,opts] of [
 ["global switch OFF",{flag:false,canary:USER}],
 ["empty canary list",{flag:true,canary:""}],
 ["non-matching canary",{flag:true,canary:"33333333-3333-4333-8333-333333333333"}],
 ["malformed canary",{flag:true,canary:"all,not-a-uuid"}],
]){
 test("atomic grant bypassed when "+description,async()=>{
  const f=fixture(opts);
  await assert.rejects(f.grant(),/unexpected legacy DB query/);
  assert.deepEqual(f.calls,["LEGACY_DB"]);
 });
}
test("canary supports normalized UUIDs in comma-separated list",async()=>{
 const f=fixture({canary:"33333333-3333-4333-8333-333333333333, 11111111-1111-4111-8111-111111111111 "});
 await f.grant();
 assert.deepEqual(f.calls,["RPC"]);
});
