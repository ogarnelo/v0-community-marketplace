import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const routes=[
 ["soporte","app/api/support/tickets/route.ts",true],
 ["solicitud de centro","app/api/schools/requests/route.ts",true],
 ["atribución de contacto","app/api/demand/attribute-contact/route.ts",false],
];
function harness(path,publicForm,opts={}){
 const calls=[];let user={id:ID,email:"qa@example.invalid",email_confirmed_at:"2026-11-01T00:00:00Z"};
 const fakeClient={auth:{getUser:async()=>{
   calls.push("AUTH");
   if(opts.authThrows)throw Error("PRIVATE_AUTH_EXCEPTION");
   return {data:{user:opts.guest?null:user},error:
    opts.missing?{name:"AuthSessionMissingError"}:
    opts.missingCode?{code:"session_not_found"}:
    opts.provider?{message:"PRIVATE_PROVIDER_DIAGNOSTIC",name:"ProviderDown"}:null};
  }}};
 const mocks={
  "next/server":{NextResponse:{json:(body,options={})=>
    new Response(JSON.stringify(body),{status:options.status??200,headers:options.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
    calls.push("CLIENT");if(opts.clientThrows)throw Error("PRIVATE_CREATE_EXCEPTION");
    return fakeClient;
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{
    calls.push("ADMIN");
    return {};
  }},
  "@/lib/demand/need-attribution":{attributeNeedToConversation:async(_admin,args)=>{
    calls.push("ATTRIBUTION");
    return {reason:"none",listingId:args.listingId};
  }},
  "@/lib/emails/admin-alert-emails":{
    sendSupportTicketAdminEmail:async()=>{throw Error("NO_REAL_EMAIL");},
    sendSchoolRegistrationAdminEmail:async()=>{throw Error("NO_REAL_EMAIL");}
  }
 };
 const code=readFileSync(path,"utf8");
 const c=ts.transpileModule(code,{fileName:path,reportDiagnostics:true,
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 assert.equal((c.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exp={};const logs=[];
 vm.runInNewContext(c.outputText,{
  exports:exp,require:id=>mocks[id]??{},Request,Response,Promise,Date,URL,
  console:{error:(...args)=>logs.push(args)},
 },{filename:path,timeout:1500});
 return {calls,logs,call:async()=>{
  const data=publicForm?{}:{listingId:ID,conversationId:ID};
  const response=await exp.POST(new Request("https://synthetic.invalid/api/test",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)}));
  return {status:response.status,cache:response.headers.get("cache-control"),
    body:await response.json()};
 }};
}
for(const [label,path,publicForm] of routes) {
 for(const [scenario,settings,status] of [
  ["sin usuario",{guest:true},publicForm?400:401],
  ["AuthSessionMissingError con usuario residual",{missing:true},publicForm?400:401],
  ["session_not_found con usuario residual",{missingCode:true},publicForm?400:401],
  ["avería real de Auth con usuario residual",{provider:true},503],
  ["getUser lanza",{authThrows:true},503],
  ["createClient lanza",{clientThrows:true},503],
 ]){
  test(label+" — "+scenario,async()=>{
   const h=harness(path,publicForm,settings),r=await h.call();
   assert.equal(r.status,status);
   assert.equal(r.cache,"private, no-store");
   assert.equal(h.calls.includes("ADMIN"),false);
   assert.equal(h.calls.includes("ATTRIBUTION"),false);
   assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_|DIAGNOSTIC|EXCEPTION/);
  });
 }
 if(publicForm)test(label+" — usuario válido con entrada no válida se rechaza sin SQL",async()=>{
  const h=harness(path,publicForm),r=await h.call();
  assert.equal(r.status,400);
  assert.equal(h.calls.includes("ADMIN"),false);
  assert.equal(r.cache,"private, no-store");
 });
}
test("atribución con usuario legítimo conserva la llamada de servicio",async()=>{
 const h=harness(routes[2][1],false),r=await h.call();
 assert.equal(r.status,200);assert.equal(r.cache,"private, no-store");
 assert.equal(h.calls.includes("ATTRIBUTION"),true);
});
