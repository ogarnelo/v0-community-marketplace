import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const uid="11111111-1111-4111-8111-111111111111";
const cid="22222222-2222-4222-8222-222222222222";
const mid="33333333-3333-4333-8333-333333333333";
const routes=[
 {path:"app/api/messages/send/route.ts",method:"POST",
  url:"https://synthetic.invalid/api/messages/send"},
 {path:"app/api/messages/conversation-summary/route.ts",method:"GET",
  url:"https://synthetic.invalid/api/messages/conversation-summary?conversation_id="+cid},
];
function fixture(route,{authError=false,user=true,throws=false}={}){
 const calls=[];
 const modules={
  "next/server":{NextResponse:{json:(payload,o={})=>new Response(JSON.stringify(payload),{
   status:o.status??200,headers:o.headers??{}
  })}},
  "@/lib/supabase/server":{createClient:async()=>({
    auth:{getUser:async()=>{
      calls.push("AUTH");
      if(throws)throw Error("PRIVATE_AUTH_EXCEPTION");
      return{data:{user:user?{id:uid}:null},
       error:authError?{message:"PRIVATE_AUTH_DIAGNOSTIC"}:null};
    }},
    from:table=>{calls.push("SESSION_QUERY:"+table);throw Error("UNEXPECTED_SESSION_SQL")}
  })},
  "@/lib/supabase/admin":{createAdminClient:()=>{
    calls.push("ADMIN_CREATED");throw Error("UNEXPECTED_PRIVILEGED_READ");
  }}
 };
 const transformed=ts.transpileModule(readFileSync(route.path,"utf8"),{
  fileName:route.path,reportDiagnostics:true,compilerOptions:{
   module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 });
 assert.equal((transformed.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exports={};
 vm.runInNewContext(transformed.outputText,{
   exports,require:name=>modules[name]??{},Request,Response,Date,URL,Promise,
   console:{error:()=>{}}
 },{filename:route.path,timeout:1500});
 return{calls,run:async()=>{
   const options=route.method==="POST"?{method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({conversationId:cid,messageId:mid})}:undefined;
   const r=await exports[route.method](new Request(route.url,options));
   return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json()};
 }};
}
for(const route of routes){
 test(route.method+" "+route.path+": provider failure with stale user is 503 before SQL/admin",async()=>{
  const f=fixture(route,{authError:true});
  const r=await f.run();
  assert.equal(r.status,503);assert.equal(r.cache,"private, no-store");
  assert.deepEqual(f.calls,["AUTH"]);
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_AUTH/);
 });
 test(route.path+": absent user without Auth error is 401 before SQL/admin",async()=>{
  const f=fixture(route,{user:false});const r=await f.run();
  assert.equal(r.status,401);assert.deepEqual(f.calls,["AUTH"]);
  assert.equal(r.cache,"private, no-store");
 });
 test(route.path+": thrown Auth exception never invokes service role",async()=>{
  const f=fixture(route,{throws:true});const r=await f.run();
  assert.ok([500,503].includes(r.status));assert.deepEqual(f.calls,["AUTH"]);
  assert.equal(r.cache,"private, no-store");
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_AUTH_EXCEPTION/);
 });
}
