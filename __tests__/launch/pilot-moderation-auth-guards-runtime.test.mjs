import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SCENARIOS = [
  ["invitado sin usuario", { guest:true }, 401],
  ["sesión ausente con identidad residual", { missing:true }, 401],
  ["session_not_found con identidad residual", { missingCode:true }, 401],
  ["proveedor falla con identidad residual", { provider:true }, 503],
  ["Auth lanza excepción", { throws:true }, 500],
  ["crear cliente lanza excepción", { clientThrows:true }, 500],
];
const routes = [
  ["denuncia", "app/api/reports/route.ts", false],
  ["estado moderación", "app/api/admin/reports/status/route.ts", true],
  ["activación centro", "app/api/admin/toggle-school-active/route.ts", true],
  ["rechazo solicitud", "app/api/admin/reject-school-request/route.ts", true],
];
function setup(path, settings={}) {
 const calls=[],user={id:USER_ID,email_confirmed_at:"2026-11-01",email:"local@example.invalid"};
 const supabase={
  auth:{getUser:async()=>{
   calls.push("AUTH");
   if(settings.throws)throw Error("PRIVATE_AUTH_DIAGNOSTIC");
   return {data:{user:settings.guest?null:user},
    error:settings.missing?{name:"AuthSessionMissingError"}:
      settings.missingCode?{code:"session_not_found"}:
      settings.provider?{name:"ProviderDown",message:"PRIVATE_PROVIDER_DIAGNOSTIC"}:null};
  }},
  from:(table)=>{
   calls.push("READ:"+table);
   const chain={
    select:()=>chain,eq:()=>chain,limit:()=>chain,
    then:(resolve,reject)=>Promise.resolve({
      data:settings.roleError?null:settings.noRole?[]:[{role:"super_admin"}],
      error:settings.roleError?{message:"PRIVATE_ROLE_DIAGNOSTIC"}:null
    }).then(resolve,reject)
   };
   return chain;
  }
 };
 const mocks={
  "next/server":{NextResponse:{json:(body,opts={})=>
    new Response(JSON.stringify(body),{status:opts.status??200,headers:opts.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
    calls.push("CLIENT");
    if(settings.clientThrows)throw Error("PRIVATE_CREATE_DIAGNOSTIC");
    return supabase;
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{
    calls.push("ADMIN");
    throw Error("ADMIN_MUST_NOT_RUN_UNDER_AUTH_FAILURE");
  }}
 };
 const code=readFileSync(path,"utf8");
 const transpiled=ts.transpileModule(code,{fileName:path,reportDiagnostics:true,
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 assert.equal((transpiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exp={},logs=[];
 vm.runInNewContext(transpiled.outputText,{
  exports:exp,require:id=>{if(!(id in mocks))throw Error("Unexpected import "+id);return mocks[id];},
  Date,Request,Response,Promise,URL,console:{error:(...args)=>logs.push(args)},
 },{filename:path,timeout:1500});
 return {calls,logs,call:async()=>{
  const req=new Request("https://synthetic.invalid/api/endpoint",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({targetType:"listing",targetId:USER_ID,reason:"spam",
    reportId:USER_ID,status:"resolved",schoolId:USER_ID,active:false,requestId:USER_ID})});
  const r=await exp.POST(req);
  return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json()};
 }};
}
for (const [label,path,adminOnly] of routes) {
 for(const [scenario,settings,status] of SCENARIOS){
  test(label+": "+scenario+" => "+status+" sin acceso privilegiado",async()=>{
   const h=setup(path,settings),r=await h.call();
   assert.equal(r.status,status);
   assert.equal(r.cache,"private, no-store");
   assert.equal(h.calls.includes("ADMIN"),false);
   assert.equal(h.calls.some(x=>x.startsWith("READ:")),false);
   assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_|DIAGNOSTIC|ADMIN_MUST_NOT/);
  });
 }
 if(adminOnly){
  for(const [scenario,settings,status] of [
   ["sin rol de super_admin",{noRole:true},403],
   ["error de consulta de roles",{roleError:true},503],
  ]) {
   test(label+": "+scenario+" no alcanza servicio privilegiado",async()=>{
    const h=setup(path,settings),r=await h.call();
    assert.equal(r.status,status);
    assert.equal(r.cache,"private, no-store");
    assert.equal(h.calls.includes("ADMIN"),false);
    assert.equal(h.calls.includes("READ:user_roles"),true);
    assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_|DIAGNOSTIC/);
   });
  }
 }
}
