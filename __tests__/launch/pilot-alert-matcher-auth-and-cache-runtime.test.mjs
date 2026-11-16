import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const source=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
const uid="11111111-1111-4111-8111-111111111111";
const listing="22222222-2222-4222-8222-222222222222";
function handler({user=true,authError=false,authThrows=false,signed=false,workerHeader=true,listingId=listing}={}){
 const actions=[];
 const fakeClient={auth:{getUser:async()=>{
  actions.push("AUTH_GET_USER");
  if(authThrows)throw Error("PRIVATE_AUTH_EXCEPTION");
  return {data:{user:user?{id:uid}:null},error:authError?{message:"PRIVATE_AUTH_DIAGNOSTIC"}:null};
 }}};
 const modules={
  "next/server":{NextResponse:{json:(payload,o={})=>
   new Response(JSON.stringify(payload),{status:o.status??200,headers:o.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>fakeClient},
  "@/lib/supabase/admin":{createAdminClient:()=>{
   actions.push("ADMIN_CREATED");
   throw Error("SYNTHETIC_ADMIN_ACCESS_BLOCKED");
  }}
 };
 const compiled=ts.transpileModule(source,{
  fileName:"match-saved-searches/route.ts",reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 });
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exports={};
 vm.runInNewContext(compiled.outputText,{
  exports,require:id=>modules[id]??{},Date,Promise,Request,Response,
  process:{env:{CRON_SECRET:"synthetic-cron",WETUDY_ALERT_OUTBOX_ENABLED:"true",
   WETUDY_ALERT_INTENT_DELIVERY_ENABLED:"true"}},
  console:{error:()=>{}}
 },{filename:"matcher.ts",timeout:1500});
 return {actions,run:async()=>{
  const req=new Request("https://fixture.invalid/api/marketplace/listings/match-saved-searches",{
   method:"POST",headers:{"content-type":"application/json",
     ...(signed?{authorization:"Bearer synthetic-cron"}:{}),
     ...(workerHeader?{"x-wetudy-alert-outbox":"1"}:{})},
   body:JSON.stringify({listingId,stage:"discover",leaseToken:listing})
  });
  const res=await exports.POST(req);
  return {status:res.status,cache:res.headers.get("cache-control"),body:await res.json()};
 }};
}
test("guest matching returns private 401 before accessing privileged listing data",async()=>{
 const f=handler({user:false}),r=await f.run();
 assert.equal(r.status,401);assert.equal(r.cache,"private, no-store");
 assert.deepEqual(f.actions,["AUTH_GET_USER"]);
});
test("Auth failure with stale user returns 503 and does not reach service role",async()=>{
 const f=handler({authError:true}),r=await f.run();
 assert.equal(r.status,503);assert.deepEqual(f.actions,["AUTH_GET_USER"]);
 assert.equal(r.cache,"private, no-store");
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_AUTH/);
});
test("Auth exception fails closed before privileged listing reads",async()=>{
 const f=handler({authThrows:true}),r=await f.run();
 assert.equal(r.status,500);assert.deepEqual(f.actions,["AUTH_GET_USER"]);
 assert.equal(r.cache,"private, no-store");
 assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_AUTH_EXCEPTION/);
});
test("signed worker bypasses user Auth only with both flags and worker header",async()=>{
 const f=handler({user:false,signed:true}),r=await f.run();
 assert.equal(r.status,500);assert.deepEqual(f.actions,["ADMIN_CREATED"]);
 assert.equal(r.cache,"private, no-store");
});
test("signed bearer without matching worker header cannot become a worker",async()=>{
 const f=handler({user:false,signed:true,workerHeader:false}),r=await f.run();
 assert.equal(r.status,401);assert.deepEqual(f.actions,["AUTH_GET_USER"]);
});
test("bad listing ID returns private 400 without creating service-role client",async()=>{
 const f=handler({listingId:"invalid"}),r=await f.run();
 assert.equal(r.status,400);assert.deepEqual(f.actions,["AUTH_GET_USER"]);
 assert.equal(r.cache,"private, no-store");
});
test("matcher emits private no-store for its complete response family",()=>{
 assert.match(source,/function privateJson\(body: unknown/);
 assert.match(source,/headers: \{ \.\.\.init\.headers, \.\.\.PRIVATE_HEADERS \}/);
 const withoutHelper=source.replace(/function privateJson\([\s\S]*?\n\}/,"");
 const remaining=withoutHelper.match(/return NextResponse\.json\(/g)||[];
 assert.equal(remaining.length,1,"Only existing fixed diagnostic catch may use NextResponse.json directly");
});
