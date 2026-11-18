import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const ts=createRequire(import.meta.url)("typescript");
const SCHOOL="11111111-1111-4111-8111-111111111111";
const USER="22222222-2222-4222-8222-222222222222";
const OTHER="33333333-3333-4333-8333-333333333333";
function fixture(options={}){
 const events=[];let authReads=0,roleReads=0,schoolReads=0;
 const userBase={id:USER,email:"school@example.invalid",
  email_confirmed_at:"2026-11-01T00:00:00Z"};
 const supabase={
  auth:{getUser:async()=>{
   authReads++;events.push("AUTH"+authReads);
   return {data:{user:{...userBase,
    id:options.swappedSession&&authReads>1?OTHER:USER,
    email:options.changedEmail&&authReads>1?"other@example.invalid":userBase.email,
    email_confirmed_at:options.unverified&&authReads>1?null:userBase.email_confirmed_at}},
    error:options.authOutage&&authReads>1?new Error("UNAVAILABLE"):null};
  }},
  from(table){
   assert.equal(table,"user_roles");
   return {select(){return this},eq(){
    roleReads++;events.push("ROLE"+roleReads);
    return Promise.resolve({data:options.revokedRole&&roleReads>1?[]:
      [{role:"school_admin",school_id:SCHOOL}],
      error:options.roleOutage&&roleReads>1?new Error("DB_FAIL"):null});
   }};
  }
 };
 const admin={from(table){
  events.push("FROM:"+table);
  if(table==="schools"){
   return {select(){return this},eq(){return this},maybeSingle:async()=>{
    schoolReads++;events.push("SCHOOL"+schoolReads);
    return {data:{id:SCHOOL,is_active:!(options.deactivated&&schoolReads>1)},
     error:options.schoolOutage&&schoolReads>1?new Error("DB_FAIL"):null};
   }};
  }
  if(table==="school_impact_report_deliveries")return {insert:async()=>{
   events.push("DELIVERY");return {error:null};
  }};
  if(table==="school_impact_report_subscriptions")return {
   select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:null}),
   upsert:async()=>{events.push("SUBSCRIPTION");return {error:null}}
  };
  throw Error("unknown table "+table);
 }};
 const mocks={
  "next/server":{NextResponse:{json:(x,opts={})=>Response.json(x,{status:opts.status??200,headers:opts.headers})}},
  "@/lib/supabase/admin":{createAdminClient:()=>admin},
  "@/lib/supabase/server":{createClient:async()=>supabase},
  "@/lib/emails/school-impact-report-email":{sendMonthlySchoolImpactEmail:async()=>{events.push("EMAIL");return {id:"mock-message-id"}}},
  "@/lib/reports/school-impact-report":{
   loadSchoolImpactReport:async()=>{events.push("REPORT");return {school:{id:SCHOOL,is_active:true}};},
   previousCalendarMonth:()=>({start:new Date("2026-10-01Z"),end:new Date("2026-11-01Z"),
     label:"Octubre 2026",key:"2026-10"}),
   renderSchoolImpactPdf:()=>{events.push("PDF");return new Uint8Array([37,80,68,70])}
  }
 };
 const mod={};
 const source=readFileSync("app/api/school/send-impact-report/route.ts","utf8");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
  target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{exports:mod,require:name=>{assert.ok(name in mocks,name);return mocks[name]},
  Date,Response,Request,Uint8Array,console:{error:()=>{}},
 },{timeout:1500});
 return {events,run:async()=>{
  const res=await mod.POST(new Request("https://wetudy.invalid/api/school/send-impact-report",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({email:"school@example.invalid"}),
  }));
  return {status:res.status,body:await res.json(),cache:res.headers.get("Cache-Control")};
 }};
}
test("legitimate verified admin is rechecked before a synthetic email is sent",async()=>{
 const h=fixture(),res=await h.run();
 assert.equal(res.status,200);assert.equal(res.cache,"private, no-store");
 assert.equal(h.events.filter(x=>x==="EMAIL").length,1);
 for(const key of ["AUTH2","ROLE2","SCHOOL2"])assert.ok(h.events.includes(key));
 assert.ok(h.events.indexOf("EMAIL")>h.events.indexOf("SCHOOL2"));
});
test("revoked school role after rendering prevents external report delivery",async()=>{
 const h=fixture({revokedRole:true}),res=await h.run();
 assert.equal(res.status,403);assert.ok(h.events.includes("PDF"));
 assert.equal(h.events.includes("EMAIL"),false);
 assert.equal(h.events.includes("DELIVERY"),false);
});
test("email changed, unverified or session replaced after loading prevents report delivery",async()=>{
 for(const opt of [{changedEmail:true},{unverified:true},{swappedSession:true}]){
  const h=fixture(opt),res=await h.run();
  assert.equal(res.status,403);assert.equal(h.events.includes("EMAIL"),false);
 }
});
test("school revoked between load and sending denies with no provider call",async()=>{
 const h=fixture({deactivated:true}),res=await h.run();
 assert.equal(res.status,403);assert.equal(h.events.includes("EMAIL"),false);
});
test("postflight auth, role and school read outages fail closed without sending",async()=>{
 for(const opt of [{authOutage:true},{roleOutage:true},{schoolOutage:true}]){
  const h=fixture(opt),res=await h.run();
  assert.equal(res.status,503);assert.equal(h.events.includes("EMAIL"),false);
 }
});
