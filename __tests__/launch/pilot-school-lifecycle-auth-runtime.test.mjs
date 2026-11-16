import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const routes=[
 ["aprobación de centro","app/api/admin/approve-school-request/route.ts"],
 ["eliminación de centro","app/api/admin/delete-school/route.ts"],
 ["invitación de administrador","app/api/admin/invite-school-admin/route.ts"],
 ["vinculación oficial","app/api/admin/link-directory-school/route.ts"],
];
function runtime(path,opts={}){
 const calls=[],exp={};
 const user={id:ID,email:"admin@example.invalid",email_confirmed_at:"2026-11-01"};
 const chain={
  select:()=>chain,eq:()=>chain,limit:()=>chain,
  then:(resolve,reject)=>Promise.resolve({
    data:opts.emptyRoles?[]:[{role:"super_admin",school_id:null}],
    error:opts.roleError?{message:"PRIVATE_ROLE_SQL_ERROR"}:null
  }).then(resolve,reject)
 };
 const supabase={
  auth:{getUser:async()=>{
   calls.push("AUTH");
   if(opts.throwAuth)throw Error("PRIVATE_AUTH_CRASH");
   return {data:{user:opts.guest?null:user},error:
    opts.missing?{name:"AuthSessionMissingError"}:
    opts.missingCode?{code:"session_not_found"}:
    opts.provider?{name:"AuthProviderDown",message:"PRIVATE_AUTH_DOWN"}:null};
  }},
  from:table=>{calls.push("ROLE_READ:"+table);return chain;}
 };
 const mocks={
  "next/server":{NextResponse:{json:(body,config={})=>
   new Response(JSON.stringify(body),{status:config.status??200,headers:config.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
    calls.push("CLIENT");
    if(opts.throwClient)throw Error("PRIVATE_CREATE_CRASH");
    return supabase;
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{
    calls.push("PRIVILEGED_DB");throw Error("MUST_NOT_USE_PRIVILEGED_DB");
  }},
  "@/lib/admin/roles":{getAdminFlags:({roles})=>({isSuperAdmin:roles?.some(x=>x.role==="super_admin")})},
  "@/lib/admin/school-admin-invitation":{provisionSchoolAdminAccess:async()=>{
    calls.push("PRIVILEGED_INVITE");throw Error("MUST_NOT_INVITE");
  }},
  "@/lib/auth/public-origin":{getAuthPublicOrigin:()=> "https://www.wetudy.com"}
 };
 const content=readFileSync(path,"utf8");
 const compiled=ts.transpileModule(content,{fileName:path,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const logs=[];
 vm.runInNewContext(compiled.outputText,{
  exports:exp,require:id=>mocks[id]??{},console:{error:(...args)=>logs.push(args)},
  Request,Response,URL,Date,Promise
 },{filename:path,timeout:1500});
 return {calls,logs,call:async()=>{
  const response=await exp.POST(new Request("https://synthetic.invalid/api",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({schoolId:"invalid",requestId:"",email:"",
    officialCode:"bad",mode:"preview"})}));
  return {status:response.status,cache:response.headers.get("cache-control"),body:await response.json()};
 }};
}
for (const [label,path] of routes){
 for(const [scenario,opts,status] of [
  ["invitado",{guest:true},401],
  ["AuthSessionMissingError con usuario residual",{missing:true},401],
  ["session_not_found con usuario residual",{missingCode:true},401],
  ["proveedor Auth falla con usuario residual",{provider:true},503],
  ["getUser lanza excepción",{throwAuth:true},path.includes("link-directory-school")?503:500],
  ["createClient lanza excepción",{throwClient:true},path.includes("link-directory-school")?503:500],
  ["consulta de superadmin falla",{roleError:true},503],
  ["sin superadmin",{emptyRoles:true},403],
 ]){
  test(label+" · "+scenario+" => "+status,async()=>{
   const h=runtime(path,opts),r=await h.call();
   assert.equal(r.status,status);
   assert.equal(r.cache,"private, no-store");
   assert.ok(!h.calls.includes("PRIVILEGED_DB"));
   assert.ok(!h.calls.includes("PRIVILEGED_INVITE"));
   assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_|MUST_NOT/);
   if(opts.guest||opts.missing||opts.missingCode||opts.provider||opts.throwAuth||opts.throwClient)
      assert.ok(!h.calls.some(x=>x.startsWith("ROLE_READ:")));
  });
 }
 test(label+" · superadmin validado, datos de entrada insuficientes => 400",async()=>{
  const h=runtime(path),r=await h.call();
  assert.equal(r.status,400);assert.equal(r.cache,"private, no-store");
  assert.ok(h.calls.includes("ROLE_READ:user_roles"));
  assert.ok(!h.calls.includes("PRIVILEGED_DB"));
  assert.ok(!h.calls.includes("PRIVILEGED_INVITE"));
 });
}
