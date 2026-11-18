import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const SCHOOL="11111111-1111-4111-8111-111111111111";
const USER="22222222-2222-4222-8222-222222222222";
const OTHER="33333333-3333-4333-8333-333333333333";
function setup(options={}){
 const events=[];let roleReads=0,userReads=0;
 const role={role:"school_admin",school_id:SCHOOL};
 const supabase={
  auth:{getUser:async()=>{
   userReads++;events.push("AUTH"+userReads);
   return {data:{user:{id:options.swappedSession && userReads>1?OTHER:USER}},
    error:options.authOutage && userReads>1?new Error("PRIVATE_AUTH"):null};
  }},
  from(table){
   assert.equal(table,"user_roles");
   return {
    select(){return this},
    eq(){roleReads++;events.push("ROLE"+roleReads);
     return Promise.resolve({data:options.rolesOutage && roleReads>1?null:
      options.revokedDuringLoad && roleReads>1?[]:[role],
      error:options.rolesOutage && roleReads>1?new Error("PRIVATE_ROLES"):null});
    }
   };
  }
 };
 const admin={
  from(table){
   assert.equal(table,"schools");events.push("SCHOOL");
   return {select(){return this},eq(){return this},maybeSingle:async()=>({
    data:{id:SCHOOL,is_active:true},error:null})};
  }
 };
 const mocks={
  "next/server":{NextResponse:{json:(obj,config={})=>
   Response.json(obj,{status:config.status??200,headers:config.headers})}},
  "@/lib/supabase/server":{createClient:async()=>supabase},
  "@/lib/supabase/admin":{createAdminClient:()=>admin},
  "@/lib/reports/school-impact-report":{
   dashboardRange:()=>({start:null,end:new Date("2026-11-18T10:00:00Z"),label:"Histórico",key:"historico"}),
   loadSchoolImpactReport:async()=>{
    events.push("REPORT");
    return {school:{id:SCHOOL,name:"Colegio sintético",is_active:true},periodKey:"historico"};
   },
   renderSchoolImpactPdf:()=>{events.push("PDF");return new Uint8Array([37,80,68,70])},
  }
 };
 const output={};
 const source=readFileSync("app/api/school/impact-report/route.ts","utf8");
 const transpiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(transpiled,{exports:output,require:name=>{
  assert.ok(name in mocks,name);return mocks[name];
 },Date,URL,Response,Request,Uint8Array,console:{error:()=>{}},process:{env:{}}},
 {timeout:1800});
 return {events,run:async()=>{
  const res=await output.GET(new Request("https://wetudy.invalid/api/school/impact-report?range=total"));
  return {status:res.status,contentType:res.headers.get("Content-Type"),cache:res.headers.get("Cache-Control")};
 }};
}
test("active original school grant may release a private PDF after two session and role checks",async()=>{
 const h=setup(),x=await h.run();
 assert.equal(x.status,200);assert.match(x.contentType,/application\/pdf/);
 assert.equal(x.cache,"private, no-store");
 assert.deepEqual(h.events.filter(e=>e.startsWith("AUTH")),["AUTH1","AUTH2"]);
 assert.deepEqual(h.events.filter(e=>e.startsWith("ROLE")),["ROLE1","ROLE2"]);
 assert.ok(h.events.indexOf("ROLE2")>h.events.indexOf("REPORT"));
 assert.ok(h.events.indexOf("PDF")>h.events.indexOf("ROLE2"));
});
test("revoking school role during privileged report generation denies PDF",async()=>{
 const h=setup({revokedDuringLoad:true}),x=await h.run();
 assert.equal(x.status,403);assert.equal(x.cache,"private, no-store");
 assert.ok(h.events.includes("REPORT"));assert.equal(h.events.includes("PDF"),false);
});
test("session changed during load denies PDF even if old school grant still exists",async()=>{
 const h=setup({swappedSession:true}),x=await h.run();
 assert.equal(x.status,403);assert.equal(h.events.includes("PDF"),false);
 assert.equal(h.events.includes("ROLE2"),false);
});
test("postflight authorization outage fails closed without releasing PDF",async()=>{
 for(const opts of [{authOutage:true},{rolesOutage:true}]){
  const h=setup(opts),x=await h.run();
  assert.equal(x.status,503);assert.equal(h.events.includes("PDF"),false);
 }
});
