import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
function fixture(o={}){
 const events=[],out={},user={id:ID};
 const mocks={
  "next/server":{NextResponse:{json:(data,opts={})=>new Response(JSON.stringify(data),
   {status:opts.status??200,headers:opts.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
   events.push("CREATE_SESSION");
   if(o.clientThrows)throw Error("PRIVATE_CLIENT");
   return {auth:{getUser:async()=>{
     events.push("AUTH");
     if(o.authThrows)throw Error("PRIVATE_AUTH");
     return {data:{user:o.guest?null:user},error:
       o.sessionMissing?{name:"AuthSessionMissingError"}:
       o.sessionNotFound?{code:"session_not_found"}:
       o.authDown?{name:"ProviderDown",message:"PRIVATE_AUTH"}:null};
   }}};
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{
   events.push("CREATE_ADMIN");
   return {from:(table)=>{
     const q={select:()=>q,eq:()=>q,order:()=>q,
     maybeSingle:async()=>({data:{user_type:o.currentType??"parent"},
       error:o.profileSql?{message:"PRIVATE_PROFILE"}:null}),
     then:(resolve,reject)=>Promise.resolve({
       data:[],error:o.studentsSql?{message:"PRIVATE_STUDENTS"}:null
     }).then(resolve,reject)};
     events.push("FROM:"+table);return q;
   }};
  }}
 };
 const src=readFileSync("app/api/account/type/route.ts","utf8");
 const js=ts.transpileModule(src,{reportDiagnostics:true,compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal(js.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
 vm.runInNewContext(js.outputText,{exports:out,require:k=>mocks[k]??{},
 Date,Promise,Response,Request,console:{error:()=>{}}},{filename:"account-type.ts",timeout:1800});
 return {events,post:async(body={userType:"parent"})=>{
 const response=await out.PATCH(new Request("https://fixture.invalid/api",{method:"PATCH",
  headers:{"content-type":"application/json"},body:JSON.stringify(body)}));
 return {status:response.status,cache:response.headers.get("cache-control"),body:await response.json()};
 }};
}
for(const [scenario,opts,status] of [
 ["guest",{guest:true},401],
 ["missing session with residual user",{sessionMissing:true},401],
 ["session_not_found with residual user",{sessionNotFound:true},401],
 ["Auth unavailable with residual user",{authDown:true},503],
 ["getUser throws",{authThrows:true},503],
 ["client initialization fails",{clientThrows:true},503]
]){
 test(scenario+" => "+status+" without elevated client",async()=>{
  const x=fixture(opts),response=await x.post();
  assert.equal(response.status,status);
  assert.equal(response.cache,"private, no-store");
  assert.equal(x.events.includes("CREATE_ADMIN"),false);
  assert.doesNotMatch(JSON.stringify(response.body),/PRIVATE_/);
 });
}
test("valid parent and no-op requested parent returns private success",async()=>{
 const x=fixture(),response=await x.post();
 assert.equal(response.status,200);
 assert.equal(response.cache,"private, no-store");
 assert.equal(response.body.userType,"parent");
 assert.ok(x.events.includes("CREATE_ADMIN"));
});
test("invalid account type stops before elevated client",async()=>{
 const x=fixture(),response=await x.post({userType:"super_admin"});
 assert.equal(response.status,400);assert.equal(response.cache,"private, no-store");
 assert.equal(x.events.includes("CREATE_ADMIN"),false);
});
test("profile read error cannot proceed into account changes",async()=>{
 const x=fixture({profileSql:true}),response=await x.post();
 assert.equal(response.status,500);
 assert.equal(response.cache,"private, no-store");
 assert.equal(response.body.code,"profile_load_failed");
});
test("student list failure cannot proceed into account changes",async()=>{
 const x=fixture({studentsSql:true}),response=await x.post();
 assert.equal(response.status,500);assert.equal(response.cache,"private, no-store");
 assert.equal(response.body.code,"students_load_failed");
});
test("source does not falsely promise rollback preservation",()=>{
 const s=readFileSync("app/api/account/type/route.ts","utf8");
 assert.match(s,/account_type_reconciliation_required/);
 assert.doesNotMatch(s,/Tus datos anteriores se han conservado/);
 assert.doesNotMatch(s,/console\.error\([^\n]*,\s*(profileError|studentsError|error)\)/);
});
