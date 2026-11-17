import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const USER="11111111-1111-4111-8111-111111111111", SCHOOL="22222222-2222-4222-8222-222222222222";
function fixture(opts={}){
 const events=[],errors=[], exports={};
 const from=(table)=>{
  const q={
   select:()=>q,eq:()=>q,
   maybeSingle:async()=>{
    if(table==="schools")return {data:{id:SCHOOL,is_active:true},error:null};
    if(table==="school_impact_report_subscriptions")
      return {data:{enabled:false,day_of_month:1},
        error:opts.readFailure?{message:"PRIVATE_READ_SQL"}:null};
    throw Error("unexpected "+table);
   },
   insert:async()=>{events.push("DELIVERY");return {error:opts.deliveryFailure?{message:"PRIVATE_DELIVERY_SQL"}:null};},
   upsert:async()=>{events.push("SUBSCRIPTION_WRITE");return {error:opts.writeFailure?{message:"PRIVATE_WRITE_SQL"}:null};}
  };return q;
 };
 const deps={
 "next/server":{NextResponse:{json:(body,options={})=>new Response(JSON.stringify(body),{
  status:options.status||200,headers:options.headers,
 })}},
 "@/lib/supabase/server":{createClient:async()=>({
  auth:{getUser:async()=>({data:{user:{id:USER,email:"verified@example.invalid",
   email_confirmed_at:"2026-11-01T00:00:00Z"}},error:null})},
  from:()=>({select:()=>({eq:async()=>({data:[{role:"school_admin",school_id:SCHOOL}],error:null})})})
 })},
 "@/lib/supabase/admin":{createAdminClient:()=>({from})},
 "@/lib/emails/school-impact-report-email":{sendMonthlySchoolImpactEmail:async()=>{
  events.push("EMAIL");return {id:"synthetic-provider-id"};}},
 "@/lib/reports/school-impact-report":{
  loadSchoolImpactReport:async()=>({school:{is_active:true}}),
  previousCalendarMonth:()=>({start:"2026-10-01",end:"2026-10-31",label:"octubre",key:"2026-10"}),
  renderSchoolImpactPdf:()=>new Uint8Array(),
 }
 };
 const src=readFileSync("app/api/school/send-impact-report/route.ts","utf8");
 const js=ts.transpileModule(src,{fileName:"manual.ts",compilerOptions:{module:ts.ModuleKind.CommonJS,
  target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 vm.runInNewContext(js.outputText,{exports,require:name=>{assert.ok(name in deps,name);return deps[name]},
  console:{error:(...args)=>errors.push(args)},Response,Request,Date,Promise},
  {filename:"manual-report.js",timeout:2000});
 return {events,errors,send:async()=>{
  const r=await exports.POST(new Request("https://wetudy.invalid/api/school/send-impact-report",{
   method:"POST",headers:{"content-type":"application/json"},body:"{}",
  }));
  return {status:r.status,body:await r.json(),cache:r.headers.get("cache-control")};
 }};
}
test("successful provider acceptance followed by subscription read failure requires reconciliation",async()=>{
 const f=fixture({readFailure:true}),r=await f.send();
 assert.equal(r.status,503);assert.match(r.body.error,/se envió.*conciliar/);
 assert.equal(r.cache,"private, no-store");assert.deepEqual(f.events,["EMAIL","DELIVERY"]);
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_READ_SQL/);
});
test("subscription write failure does not report that the email was not sent",async()=>{
 const f=fixture({writeFailure:true}),r=await f.send();
 assert.equal(r.status,503);assert.match(r.body.error,/se envió.*suscripción/);
 assert.deepEqual(f.events,["EMAIL","DELIVERY","SUBSCRIPTION_WRITE"]);
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_WRITE_SQL/);
});
test("successful send returns success only after subscription persistence",async()=>{
 const f=fixture(),r=await f.send();
 assert.equal(r.status,200);assert.equal(r.body.ok,true);
 assert.deepEqual(f.events,["EMAIL","DELIVERY","SUBSCRIPTION_WRITE"]);
});
test("failed delivery history recording never logs provider SQL errors",async()=>{
 const f=fixture({deliveryFailure:true}),r=await f.send();
 assert.equal(r.status,200);
 assert.doesNotMatch(JSON.stringify(f.errors),/PRIVATE_DELIVERY_SQL|verified@example.invalid|synthetic-provider-id/);
});
