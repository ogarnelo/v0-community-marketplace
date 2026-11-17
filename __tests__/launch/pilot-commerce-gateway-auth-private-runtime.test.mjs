import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const USER={id:"11111111-1111-4111-8111-111111111111",email:"qa@example.invalid"};
function compile(source,files){
 const out={};
 const js=ts.transpileModule(readFileSync(source,"utf8"),{
 fileName:source,reportDiagnostics:true,
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((js.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(js.outputText,{exports:out,require:k=>files[k]??{},Date,Promise,Error,
 Request,Response,URL,console:{error:()=>{}}},{filename:source,timeout:1800});
 return out;
}
function authHelper(options={}){
 const calls=[];
 const helper=compile("lib/commerce/verified-user.ts",{
 "@/lib/supabase/server":{createClient:async()=>{
   calls.push("CLIENT");
   if(options.clientThrows)throw Error("PRIVATE_CLIENT");
   return {auth:{getUser:async()=>{
     calls.push("AUTH");
     if(options.authThrows)throw Error("PRIVATE_AUTH");
     return {data:{user:options.guest?null:USER},error:
      options.sessionMissing?{name:"AuthSessionMissingError"}:
      options.sessionNotFound?{code:"session_not_found"}:
      options.authUnavailable?{name:"Unreachable",message:"PRIVATE_AUTH"}:null};
   }}};
 }}
 });
 return {calls,call:()=>helper.getVerifiedCommerceUser()};
}
for(const [label,opts,status] of [
 ["guest",{guest:true},401],
 ["missing session residual user",{sessionMissing:true},401],
 ["session_not_found residual user",{sessionNotFound:true},401],
 ["provider error residual user",{authUnavailable:true},503],
 ["getUser thrown",{authThrows:true},503],
 ["client initialization thrown",{clientThrows:true},503]
]){
 test(label+" yields no identity, status "+status,async()=>{
  const h=authHelper(opts),r=await h.call();
  assert.equal(r.user,null);assert.equal(r.errorStatus,status);
 });
}
test("verified account user can proceed, errorStatus cleared",async()=>{
 const h=authHelper(),r=await h.call();
 assert.equal(r.user.id,USER.id);assert.equal(r.errorStatus,null);
});
test("all three private commerce routes verify the user before any privileged or provider call",()=>{
 const paths=[
 "app/api/commerce/connect/account/route.ts",
 "app/api/commerce/connect/onboarding/route.ts",
 "app/api/payments/quote/route.ts"
 ];
 for(const path of paths){
  const s=readFileSync(path,"utf8");
  assert.match(s,/getVerifiedCommerceUser/);
  assert.match(s,/if \(!auth\.user\)/);
  const verification=s.indexOf("if (!auth.user)");
  const stripe=s.indexOf("assertStripeTestMode()");
  assert.ok(verification>=0&&stripe>verification,path);
  assert.doesNotMatch(s,/data: \{ user \}/);
 }
});
test("account: both GET and POST guard the provider and never log raw provider exceptions",()=>{
 const s=readFileSync("app/api/commerce/connect/account/route.ts","utf8");
 assert.equal((s.match(/getVerifiedCommerceUser\(\)/g)||[]).length,2);
 assert.equal((s.match(/if \(!auth\.user\)/g)||[]).length,2);
 assert.match(s,/seller_connect_state_failed/);
 assert.match(s,/seller_connect_onboarding_failed/);
 assert.doesNotMatch(s,/console\.error\([^\n]*,\s*error/);
});
test("all public JSONs in quote and connect account are private no-store",()=>{
 for(const path of ["app/api/commerce/connect/account/route.ts","app/api/payments/quote/route.ts"]){
 const s=readFileSync(path,"utf8");
 assert.match(s,/Cache-Control.*private, no-store/);
 assert.doesNotMatch(s,/return NextResponse\.json\((?!payload)/);
 }
});
test("quote never reflects the provider's error.message or .details",()=>{
 const s=readFileSync("app/api/payments/quote/route.ts","utf8");
 assert.doesNotMatch(s,/error\?\.message|error\?\.details/);
 assert.match(s,/No se pudo calcular el importe total/);
});
test("Connect onboarding redirects unauthorized/failed auth without running Stripe",()=>{
 const s=readFileSync("app/api/commerce/connect/onboarding/route.ts","utf8");
 assert.ok(s.indexOf("if (!auth.user)")<s.indexOf("await ensureSellerConnectAccount({"));
 assert.match(s,/connect=error/);
 assert.match(s,/Cache-Control.*private, no-store/);
});
test("private commerce role lookup remains default-deny and test-mode guarded",()=>{
 const s=readFileSync("lib/commerce/private-access.ts","utf8");
 assert.match(s,/return Boolean\(roles\?\.length\)/);
 assert.match(s,/startsWith\("sk_test_"\)/);
 assert.match(s,/startsWith\("pk_test_"\)/);
});
