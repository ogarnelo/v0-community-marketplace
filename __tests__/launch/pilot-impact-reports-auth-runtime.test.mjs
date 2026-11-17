import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const routes=[
 ["informe global","app/api/admin/super/report/route.ts","GET"],
 ["suscripción global","app/api/admin/super/report-subscription/route.ts","POST"],
 ["informe del colegio","app/api/school/impact-report/route.ts","GET"],
 ["suscripción del colegio","app/api/school/report-subscription/route.ts","POST"],
 ["envío manual del colegio","app/api/school/send-impact-report/route.ts","POST"],
];
function run(path,method,opts={}){
 const exp={},calls=[],errors=[];
 const user={id:ID,email:"admin@example.invalid",email_confirmed_at:"2026-11-01"};
 const roles=opts.noRole?[]:[{role:"super_admin",school_id:null},{role:"school_admin",school_id:ID}];
 const query={select:()=>query,eq:()=>query,limit:()=>query,
    then:(resolve,reject)=>Promise.resolve({
      data:roles,error:opts.roleError?{message:"PRIVATE_ROLE_SQL"}:null
    }).then(resolve,reject)};
 const supabase={
  auth:{getUser:async()=>{
   calls.push("AUTH");
   if(opts.throwAuth)throw Error("PRIVATE_AUTH_EXCEPTION");
   return {data:{user:opts.guest?null:user},error:
    opts.missing?{name:"AuthSessionMissingError"}:
    opts.missingCode?{code:"session_not_found"}:
    opts.provider?{name:"ProviderDown",message:"PRIVATE_AUTH_PROVIDER"}:null};
  }},
  from:(table)=>{calls.push("QUERY:"+table);return query;}
 };
 const modules={
  "next/server":{NextResponse:{json:(body,config={})=>new Response(JSON.stringify(body),
    {status:config.status??200,headers:config.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
    calls.push("CREATE_CLIENT");
    if(opts.throwClient)throw Error("PRIVATE_CLIENT_EXCEPTION");return supabase;
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{
    calls.push("PRIVILEGED");
    if(path==="app/api/school/impact-report/route.ts" && !opts.inactiveSchool)
      return {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:ID,is_active:true},error:null})})})})};
    if(path==="app/api/school/impact-report/route.ts" && opts.inactiveSchool)
      return {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:ID,is_active:false},error:null})})})})};
    throw Error("MUST_NOT_RUN_ADMIN");
  }},
  "@/lib/reports/super-admin-report":{
    normalizeSuperAdminRange:()=> "30d",loadSuperAdminReport:async()=>{calls.push("REPORT");return {title:"Synthetic"};},
    renderSuperAdminCsv:()=> "date,value\n2026-11-16,0\n",
    renderSuperAdminPdf:()=>new Uint8Array([37,80,68,70])
  },
  "@/lib/reports/school-impact-report":{
    dashboardRange:()=>({start:null,end:null,label:"Synthetic",key:"2026-11"}),
    previousCalendarMonth:()=>({start:null,end:null,label:"Synthetic",key:"2026-11"}),
    loadSchoolImpactReport:async()=>{calls.push("REPORT");return {school:{name:"QA",is_active:!opts.reportInactive},periodKey:"2026-11"};},
    renderSchoolImpactPdf:()=>new Uint8Array([37,80,68,70])
  },
  "@/lib/emails/school-impact-report-email":{sendMonthlySchoolImpactEmail:async()=>{
    calls.push("EMAIL");throw Error("MUST_NOT_SEND_EMAIL");
  }}
 };
 const code=readFileSync(path,"utf8"),compiled=ts.transpileModule(code,{
   fileName:path,reportDiagnostics:true,compilerOptions:{
     target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true
   }
 });
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(compiled.outputText,{
  exports:exp,require:name=>modules[name]??{},Request,Response,Date,URL,Promise,
  console:{error:(...args)=>errors.push(args)}
 },{filename:path,timeout:1500});
 return {calls,errors,call:async()=>{
  const url="https://synthetic.invalid/api/report?format=csv";
  const req=method==="GET"?new Request(url):new Request(url,{method:"POST",body:"{}",
    headers:{"Content-Type":"application/json"}});
  const response=await exp[method](req);
  const type=response.headers.get("content-type")||"";
  return {status:response.status,cache:response.headers.get("cache-control"),
    type,body:type.includes("json")?await response.json():await response.text()};
 }};
}
for(const [label,path,method] of routes){
 for(const [scenario,opts,status] of [
  ["invitado",{guest:true},401],
  ["sesión ausente con user residual",{missing:true},401],
  ["session_not_found con user residual",{missingCode:true},401],
  ["proveedor falla con user residual",{provider:true},503],
  ["getUser lanza",{throwAuth:true},500],
  ["cliente lanza",{throwClient:true},500],
  ["lectura de rol falla",{roleError:true},503],
  ["rol insuficiente",{noRole:true},403],
 ]){
  test(label+" — "+scenario+" => "+status,async()=>{
   const h=run(path,method,opts),r=await h.call();
   assert.equal(r.status,status);
   assert.equal(r.cache,"private, no-store");
   assert.ok(!h.calls.includes("PRIVILEGED"));
   assert.ok(!h.calls.includes("REPORT"));
   assert.ok(!h.calls.includes("EMAIL"));
   assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_|MUST_NOT/);
   if(opts.guest||opts.missing||opts.missingCode||opts.provider||opts.throwAuth||opts.throwClient)
     assert.ok(!h.calls.includes("QUERY:user_roles"));
  });
 }
}
for(const [label,path] of [
 ["informe global CSV","app/api/admin/super/report/route.ts"],
 ["PDF del colegio","app/api/school/impact-report/route.ts"]
]){
 test(label+" — usuario autorizado conserva exportación privada",async()=>{
  const h=run(path,"GET"),r=await h.call();
  assert.equal(r.status,200);assert.equal(r.cache,"private, no-store");
  assert.ok(h.calls.includes("REPORT"));
  assert.ok(r.type.includes(path.includes("super")?"text/csv":"application/pdf"));
 });
}

test("school PDF — inactive centre cannot export",async()=>{
 const h=run("app/api/school/impact-report/route.ts","GET",{inactiveSchool:true}),r=await h.call();
 assert.equal(r.status,403);
 assert.ok(!h.calls.includes("REPORT"));
});

test("school PDF — centre deactivated during report loading cannot export",async()=>{
 const h=run("app/api/school/impact-report/route.ts","GET",{reportInactive:true}),r=await h.call();
 assert.equal(r.status,403);
 assert.equal(r.cache,"private, no-store");
 assert.ok(h.calls.includes("REPORT"));
 assert.ok(!r.type.includes("application/pdf"));
});
