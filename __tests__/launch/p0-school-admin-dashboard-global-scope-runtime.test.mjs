import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const schoolA="11111111-1111-4111-8111-111111111111";
const schoolB="22222222-2222-4222-8222-222222222222";
const userId="33333333-3333-4333-8333-333333333333";
const src=readFileSync("app/admin/school/page.tsx","utf8");
const helper=readFileSync("lib/marketplace/unique-school-admin-context.ts","utf8");
const helperModule={exports:{}};
vm.runInNewContext(ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports:helperModule.exports,Error},{timeout:1200});
const compiled=ts.transpileModule(src,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX
},reportDiagnostics:true});
assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
function harness({guest=false,authError=false,roles=[{school_id:schoolA}],roleError=false,superRole=false}={}){
 const events=[],out={};
 const session={auth:{getUser:async()=>{
   events.push("AUTH");
   return {data:{user:guest?null:{id:userId,email:"user@example.invalid"}},error:authError?{message:"PRIVATE_AUTH"}:null};
 }},
 from:table=>{
  events.push("READ:"+table);
  let selectedRole=null;
  const q={
   select:()=>q,
   eq:(key,value)=>{if(key==="role")selectedRole=value;return q},
   limit:()=>q,
   maybeSingle:async()=>({data:{full_name:"Synthetic Test"},error:null}),
   then:(resolve,reject)=>Promise.resolve(table!=="user_roles"
     ? {data:null,error:null}
     : {data:selectedRole==="school_admin"?roles:superRole?[{role:"super_admin"}]:[],
        error:roleError?{message:"PRIVATE_DB"}:null}).then(resolve,reject),
  };
  return q;
 }};
 const mocks={
  "next/navigation":{redirect:path=>{events.push("REDIRECT:"+path);throw Error("REDIRECT")}},
  "@/lib/supabase/server":{createClient:async()=>session},
  "@/lib/supabase/admin":{createAdminClient:()=>{events.push("PRIVILEGED");throw Error("PRIVILEGED_REACHED")}},
  "@/lib/marketplace/unique-school-admin-context":helperModule.exports,
  "react/jsx-runtime":{jsx:()=>null,jsxs:()=>null}
 };
 vm.runInNewContext(compiled.outputText,{exports:out,require:name=>mocks[name]||{},
   Promise,Array,Error},{filename:"school-dashboard.tsx",timeout:1200});
 return {events,run:()=>out.default()};
}
test("unauthenticated school dashboard never creates privileged client",async()=>{
 const h=harness({guest:true});await assert.rejects(h.run(),/REDIRECT/);
 assert.equal(h.events.includes("PRIVILEGED"),false);
});
test("Auth outage with stale user never creates privileged client",async()=>{
 const h=harness({authError:true});await assert.rejects(h.run(),/SCHOOL_DASHBOARD_AUTH_UNAVAILABLE/);
 assert.equal(h.events.includes("PRIVILEGED"),false);
});
test("two synthetic school_admin grants cannot reveal either school's administration panel",async()=>{
 const h=harness({roles:[{school_id:schoolA},{school_id:schoolB}]});
 await assert.rejects(h.run(),/AMBIGUOUS_SCHOOL_ADMIN_CONTEXT/);
 assert.equal(h.events.includes("PRIVILEGED"),false);
});
test("duplicate school_admin grants also fail closed",async()=>{
 const h=harness({roles:[{school_id:schoolA},{school_id:schoolA}]});
 await assert.rejects(h.run(),/AMBIGUOUS_SCHOOL_ADMIN_CONTEXT/);
 assert.equal(h.events.includes("PRIVILEGED"),false);
});
test("role outage prevents service_role school data access",async()=>{
 const h=harness({roleError:true});
 await assert.rejects(h.run(),/No se han podido comprobar/);
 assert.equal(h.events.includes("PRIVILEGED"),false);
});
test("no school role redirects without privileged reads",async()=>{
 const h=harness({roles:[]});await assert.rejects(h.run(),/REDIRECT/);
 assert.equal(h.events.includes("PRIVILEGED"),false);
});
test("only an authorized single school grants access to privileged aggregation",async()=>{
 const h=harness();await assert.rejects(h.run(),/PRIVILEGED_REACHED/);
 assert.equal(h.events.includes("PRIVILEGED"),true);
});
