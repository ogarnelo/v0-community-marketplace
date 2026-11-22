import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
function fixture(o={}){
 const events=[],out={},user={id:ID,email_confirmed_at:o.unconfirmed?null:"2026-01-01T00:00:00Z"};
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
   return {
    auth:{admin:{getUserById:async()=>{
      events.push("AUTH_ADMIN_CHECK");
      if(o.authAdminDown)return {data:{user:null},error:{message:"PRIVATE_AUTH_ADMIN"}};
      return {data:{user:{id:ID,user_metadata:{user_type:o.authMetadataType??o.currentType??"parent"}}},error:null};
    }}},
    from:(table)=>{
     const q={select:()=>q,eq:()=>q,order:()=>q,
     maybeSingle:async()=>({data:{user_type:o.currentType??"parent"},
       error:o.profileSql?{message:"PRIVATE_PROFILE"}:null}),
     then:(resolve,reject)=>Promise.resolve({
       data:o.activeStudents??[],error:o.studentsSql?{message:"PRIVATE_STUDENTS"}:null
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
test("no-op parent with matching Auth and no students performs no writes",async()=>{
 const x=fixture(),r=await x.post();
 assert.equal(r.status,200);
 assert.ok(x.events.includes("AUTH_ADMIN_CHECK"));
 assert.equal(x.events.some(e=>e.startsWith("DB_WRITE")),false);
});
test("no-op with stale Auth metadata fails closed without DB writes",async()=>{
 const x=fixture({authMetadataType:"student"}),r=await x.post();
 assert.equal(r.status,409);
 assert.equal(r.body.code,"account_type_state_mismatch");
 assert.equal(r.cache,"private, no-store");
});
test("no-op with unavailable Auth returns private 503",async()=>{
 const x=fixture({authAdminDown:true}),r=await x.post();
 assert.equal(r.status,503);
 assert.equal(r.body.code,"account_type_reconciliation_required");
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
});
for(const students of [
 [{id:"one",relationship:"self",alias:null,is_primary:true}],
 [{id:"one",relationship:"guardian",alias:null,is_primary:false}],
 [{id:"one",relationship:"guardian",alias:null,is_primary:true},{id:"two",relationship:"guardian",alias:null,is_primary:true}],
]){
 test("no-op refuses inconsistent educational state",async()=>{
  const x=fixture({activeStudents:students}),r=await x.post();
  assert.equal(r.status,409);
  assert.equal(r.body.code,"account_type_state_mismatch");
 });
}
test("no-op accepts consistent guardian children",async()=>{
 const x=fixture({activeStudents:[{id:"one",relationship:"guardian",alias:null,is_primary:true}]}),r=await x.post();
 assert.equal(r.status,200);
});
test("source does not falsely promise rollback preservation",()=>{
 const s=readFileSync("app/api/account/type/route.ts","utf8");
 assert.match(s,/account_type_reconciliation_required/);
 assert.doesNotMatch(s,/Tus datos anteriores se han conservado/);
 assert.doesNotMatch(s,/console\.error\([^\n]*,\s*(profileError|studentsError|error)\)/);
});

test("unconfirmed user cannot request a type change or create admin client",async()=>{
 const x=fixture({unconfirmed:true}),response=await x.post();
 assert.equal(response.status,403);
 assert.equal(response.body.code,"email_not_confirmed");
 assert.equal(x.events.includes("CREATE_ADMIN"),false);
});
test("account type transition is guarded by confirmed Auth and profile compare-and-swap",()=>{
 const src=readFileSync("app/api/account/type/route.ts","utf8");
 assert.match(src,/\.eq\("user_type", currentType\)[\s\S]*?\.select\("id"\)[\s\S]*?\.maybeSingle\(\)/);
 assert.match(src,/!updatedProfile\?\.id/);
 assert.match(src,/ACCOUNT_TYPE_STATE_CHANGED/);
 assert.match(src,/\.eq\("active", true\)/);
 assert.match(src,/\.eq\("relationship", student\.relationship\)/);
 assert.match(src,/\.eq\("relationship", onlyStudent\.relationship\)/);
 assert.match(src,/ACCOUNT_STUDENT_STATE_CHANGED/);
 assert.match(src,/\.eq\("user_type", targetType\)/);
});
