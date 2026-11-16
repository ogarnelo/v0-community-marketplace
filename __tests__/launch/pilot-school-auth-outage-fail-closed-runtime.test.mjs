import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const src=readFileSync("app/api/marketplace/my-school/route.ts","utf8");
function harness({guest=false,authError=false,missingSession=false,authThrows=false,createThrows=false,profileThrows=false}={}){
 const operations=[],uid="11111111-1111-4111-8111-111111111111";
 const db={
  auth:{getUser:async()=>{
   operations.push("AUTH");
   if(authThrows)throw Error("PRIVATE_AUTH_UNAVAILABLE");
   return {data:{user:guest?null:{id:uid}},
     error:missingSession?{name:"AuthSessionMissingError"}:authError?{message:"PRIVATE_AUTH_FAILURE"}:null};
  }},
  from:table=>{
   operations.push("READ:"+table);
   if(profileThrows)throw Error("PRIVATE_DB_UNAVAILABLE");
   throw Error("UNEXPECTED_DB_QUERY");
  }
 };
 const mocks={
  "next/server":{NextResponse:{json:(body,opts={})=>
   new Response(JSON.stringify(body),{status:opts.status??200,headers:opts.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>{
    operations.push("CLIENT");
    if(createThrows)throw Error("PRIVATE_CREATE_CLIENT_FAILURE");
    return db;
  }},
  "@/lib/supabase/admin":{createAdminClient:()=>{
    operations.push("ADMIN");
    throw Error("PRIVILEGED_CLIENT_MUST_NOT_BE_USED");
  }},
  "@/lib/marketplace/feed-filters":{parseMarketplaceFeedFilters:()=>({})}
 };
 const compiled=ts.transpileModule(src,{fileName:"my-school.ts",reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 const exp={};const logs=[];
 vm.runInNewContext(compiled.outputText,{
  exports:exp,require:id=>mocks[id]??{},Date,Request,Response,Promise,URL,
  console:{error:(...args)=>logs.push(args)}
 },{filename:"my-school.ts",timeout:1500});
 return {operations,logs,request:async()=>{
  const res=await exp.GET(new Request("https://synthetic.invalid/api/marketplace/my-school"));
  return{status:res.status,cache:res.headers.get("cache-control"),body:await res.json()};
 }};
}
for(const [label,opts,expected,steps] of [
 ["Auth provider returned error with stale user",{authError:true},503,["CLIENT","AUTH"]],
 ["Auth service threw",{authThrows:true},503,["CLIENT","AUTH"]],
 ["creating Supabase client failed",{createThrows:true},503,["CLIENT"]],
 ["profile query failed unexpectedly",{profileThrows:true},503,["CLIENT","AUTH","READ:profiles"]]
]){
 test(label+" produces private 503 with no privileged lookup",async()=>{
  const f=harness(opts),r=await f.request();
  assert.equal(r.status,expected);
  assert.equal(r.cache,"private, no-store");
  assert.deepEqual(f.operations,steps);
  assert.equal(f.operations.includes("ADMIN"),false);
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_|UNEXPECTED_/);
 });
}
test("normal guest is still 401, not an Auth outage",async()=>{
 const f=harness({guest:true}),r=await f.request();
 assert.equal(r.status,401);
 assert.equal(r.cache,"private, no-store");
 assert.deepEqual(f.operations,["CLIENT","AUTH"]);
});
test("unexpected profile failures emit only a fixed internal log token",async()=>{
 const f=harness({profileThrows:true}),r=await f.request();
 assert.equal(r.status,503);
 assert.deepEqual(f.logs,[["marketplace_school_auth_or_scope_read_failed"]]);
});

test("missing Supabase session is a guest 401 even if stale user data accompanies it",async()=>{
 const f=harness({missingSession:true}),r=await f.request();
 assert.equal(r.status,401);assert.equal(r.cache,"private, no-store");
 assert.deepEqual(f.operations,["CLIENT","AUTH"]);
 assert.equal(f.operations.includes("ADMIN"),false);
});
