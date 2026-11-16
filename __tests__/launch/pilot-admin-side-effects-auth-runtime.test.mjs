import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const USER_ID="11111111-1111-4111-8111-111111111111";
const routes=[
  ["reenviar invitación","app/api/admin/resend-school-admin-access/route.ts"],
  ["activar demanda","app/api/admin/demand/opportunities/[key]/activate/route.ts"],
];
function handler(path,config={}){
 const calls=[],logs=[],exports={};
 const user={id:USER_ID,email:"qa-admin@example.invalid"};
 const q={select:()=>q,eq:()=>q,limit:()=>q,
  then:(resolve,reject)=>Promise.resolve({data:config.noRole?[]:[{role:"super_admin"}],
     error:config.roleError?{message:"PRIVATE_ROLE_ERROR"}:null}).then(resolve,reject)};
 const client={
  auth:{getUser:async()=>{
    calls.push("getUser");
    if(config.throwAuth)throw Error("PRIVATE_AUTH_THROW");
    return {data:{user:config.guest?null:user},error:
      config.missing?{name:"AuthSessionMissingError"}:
      config.missingCode?{code:"session_not_found"}:
      config.provider?{name:"ProviderDown",message:"PRIVATE_AUTH_PROVIDER"}:null};
  }},
  from:(name)=>{calls.push("read:"+name);return q;}
 };
 const mocks={
  "next/server":{NextResponse:{json:(obj,options={})=>new Response(JSON.stringify(obj),
   {status:options.status??200,headers:options.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
   calls.push("createClient");if(config.throwClient)throw Error("PRIVATE_CLIENT_THROW");return client;
  }},
  "@/lib/admin/school-admin-invitation":{provisionSchoolAdminAccess:async()=>{
   calls.push("INVITATION");throw Error("MUST_NOT_INVITE");
  }},
  "@/lib/auth/public-origin":{getAuthPublicOrigin:()=> "https://www.wetudy.com"},
  "@/lib/supabase/admin":{createAdminClient:()=>{
   calls.push("ADMIN");throw Error("MUST_NOT_USE_ADMIN");
  }},
  "@/lib/notifications":{createNotification:async()=>{calls.push("NOTIFICATION");throw Error("MUST_NOT_NOTIFY");}},
  "@/lib/admin/demand-opportunities":{
   activationMessage:()=> "Synthetic",
   findDemandOpportunity:async()=>{calls.push("OPPORTUNITY");return null;},
   findSupplyCandidates:async()=>[],
   opportunityMetadata:()=>({})
  }
 };
 const text=readFileSync(path,"utf8"),compiled=ts.transpileModule(text,{
   fileName:path,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(compiled.outputText,{
  exports,require:id=>mocks[id]??{},Request,Response,Promise,Date,URL,Set,
  console:{error:(...args)=>logs.push(args)}
 },{filename:path,timeout:1500});
 return {calls,logs,post:async()=>{
   const response=await exports.POST(new Request("https://fixture.invalid/action",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify(path.includes("resend")?{requestId:""}:{targetUserIds:[]})
   }),{params:Promise.resolve({key:"qa-123"})});
   return {status:response.status,cache:response.headers.get("cache-control"),body:await response.json()};
 }};
}
for(const [label,path] of routes){
 for(const [scenario,config,expected] of [
  ["invitado",{guest:true},401],
  ["sesión ausente, usuario residual",{missing:true},401],
  ["session_not_found, usuario residual",{missingCode:true},401],
  ["proveedor Auth caído, usuario residual",{provider:true},503],
  ["getUser lanza",{throwAuth:true},500],
  ["createClient lanza",{throwClient:true},500],
  ["consulta de roles falla",{roleError:true},503],
  ["no es superadmin",{noRole:true},403],
  ["superadmin, body vacío",{},400],
 ]){
  test(label+" | "+scenario+" | "+expected,async()=>{
   const h=handler(path,config),r=await h.post();
   assert.equal(r.status,expected);
   assert.equal(r.cache,"private, no-store");
   assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_|MUST_NOT/);
   assert.equal(h.calls.includes("INVITATION"),false);
   assert.equal(h.calls.includes("NOTIFICATION"),false);
   assert.equal(h.calls.includes("ADMIN"),false);
   if(config.missing||config.missingCode||config.provider||config.throwAuth||config.throwClient||config.guest)
     assert.equal(h.calls.includes("read:user_roles"),false);
  });
 }
}
