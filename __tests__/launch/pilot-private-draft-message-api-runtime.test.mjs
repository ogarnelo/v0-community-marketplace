import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const USER="11111111-1111-4111-8111-111111111111";
const CONV="22222222-2222-4222-8222-222222222222";
const MSG="33333333-3333-4333-8333-333333333333";
function runRoute(file,{failTable=null,userId=USER,participant=true,existing=null,authError=false,authThrows=false}={}){
 const operations=[];
 const row=table=>{
  if(table==="conversations")return {id:CONV,listing_id:"listing",buyer_id:participant?USER:"outsider",seller_id:"other"};
  if(table==="messages")return {id:MSG,conversation_id:CONV,sender_id:USER,body:"Synthetic private text"};
  if(table==="listing_drafts")return existing;
  return null;
 };
 const from=table=>{
  operations.push(table);
  const answer=()=>({data:row(table),error:table===failTable?{message:"PRIVATE_SQL_BACKEND_ERROR"}:null});
  const q=new Proxy({}, {get(_target,prop){
   if(prop==="then")return(resolve,reject)=>Promise.resolve(answer()).then(resolve,reject);
   if(prop==="maybeSingle"||prop==="single")return async()=>answer();
   return()=>q;
  }});
  return q;
 };
 const user=userId?{id:userId,user_metadata:{}}:null;
 const supabase={auth:{getUser:async()=>{
   if(authThrows)throw new Error("PRIVATE_AUTH_SERVICE_FAILURE");
   return{data:{user},error:authError?{message:"PRIVATE_AUTH_ERROR"}:null};
 }},from};
 const admin={from,storage:{from:()=>({remove:async()=>({error:null})})}};
 const mocks={
  "next/server":{NextResponse:{json:(body,options={})=>
   new Response(JSON.stringify(body),{status:options.status??200,headers:options.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>supabase},
  "@/lib/supabase/admin":{createAdminClient:()=>{operations.push("ADMIN_CREATED");return admin}},
  "@/lib/notifications":{createNotificationOnce:async()=>({error:null})},
  "@/lib/emails/mvp-event-emails":{sendFirstMessageEmail:async()=>{}},
  "@/lib/emails/delivery-idempotency":{sendTransactionalEmailOnce:async()=>({})}
 };
 const exports={};
 const transpiled=ts.transpileModule(readFileSync(file,"utf8"),{fileName:file,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 const logs=[];
 vm.runInNewContext(transpiled.outputText,{exports,require:name=>mocks[name]??{},Date,URL,
  Buffer,Set,Promise,Request,Response,console:{error:(...xs)=>logs.push(xs)}},
  {filename:file,timeout:1500});
 return {handlers:exports,operations,logs};
}
function request(method,body){return new Request("https://synthetic.invalid/api",{method,
 headers:{"content-type":"application/json"},body:JSON.stringify(body)})}
const privateResponse=r=>assert.equal(r.headers.get("cache-control"),"private, no-store");
const draft="app/api/marketplace/listing-draft/route.ts";
const message="app/api/messages/send/route.ts";
test("draft unauthenticated GET/PUT/DELETE never creates admin client",async()=>{
 const x=runRoute(draft,{userId:null});
 for(const [method,call] of [["GET",()=>x.handlers.GET()],["PUT",()=>x.handlers.PUT(request("PUT",{}))],["DELETE",()=>x.handlers.DELETE(request("DELETE",{}))]]){
  const r=await call();assert.equal(r.status,401,method);privateResponse(r);
 }
 assert.equal(x.operations.includes("ADMIN_CREATED"),false);
});
test("draft GET hides privileged backend error and never cacheable",async()=>{
 const x=runRoute(draft,{failTable:"listing_drafts"});
 const r=await x.handlers.GET();assert.equal(r.status,500);privateResponse(r);
 assert.equal((await r.text()).includes("PRIVATE_SQL"),false);
});
test("draft PUT fails before removing photos or writing on failed existing-read",async()=>{
 const x=runRoute(draft,{failTable:"listing_drafts"});
 const r=await x.handlers.PUT(request("PUT",{payload:{title:"fixture"},photos:[]}));
 assert.equal(r.status,503);privateResponse(r);
 assert.equal(x.operations.filter(y=>y==="listing_drafts").length,1);
});
test("draft DELETE aborts destructive cleanup on failed existing-read",async()=>{
 const x=runRoute(draft,{failTable:"listing_drafts"});
 const r=await x.handlers.DELETE(request("DELETE",{}));
 assert.equal(r.status,503);privateResponse(r);
 assert.equal(x.operations.filter(y=>y==="listing_drafts").length,1);
});
test("message invalid UUID denied without privileged queries",async()=>{
 const x=runRoute(message);
 const r=await x.handlers.POST(request("POST",{conversationId:"invalid",messageId:MSG}));
 assert.equal(r.status,400);privateResponse(r);assert.deepEqual(x.operations,[]);
});
test("message unauthorized or missing conversation never creates privileged client",async()=>{
 const x=runRoute(message,{participant:false});
 const r=await x.handlers.POST(request("POST",{conversationId:CONV,messageId:MSG}));
 assert.equal(r.status,404);privateResponse(r);
 assert.equal(x.operations.includes("ADMIN_CREATED"),false);
});
test("message query error is private 503, no privileged client",async()=>{
 const x=runRoute(message,{failTable:"conversations"});
 const r=await x.handlers.POST(request("POST",{conversationId:CONV,messageId:MSG}));
 assert.equal(r.status,503);privateResponse(r);assert.equal(x.operations.includes("ADMIN_CREATED"),false);
 assert.equal((await r.text()).includes("PRIVATE_SQL"),false);
});
test("message GET participant scope precedes privileged message lookup",async()=>{
 const x=runRoute(message,{failTable:"messages"});
 const r=await x.handlers.POST(request("POST",{conversationId:CONV,messageId:MSG}));
 assert.equal(r.status,503);privateResponse(r);
 assert.ok(x.operations.indexOf("conversations")<x.operations.indexOf("ADMIN_CREATED"));
});

for(const [method,invoke] of [
 ["GET",handlers=>handlers.GET()],
 ["PUT",handlers=>handlers.PUT(request("PUT",{payload:{title:"draft"},photos:[]}))],
 ["DELETE",handlers=>handlers.DELETE(request("DELETE",{}))]
]){
 test("draft "+method+" does not create admin client when Auth responds with an error and stale user",async()=>{
  const x=runRoute(draft,{authError:true});
  const r=await invoke(x.handlers);
  assert.equal(r.status,503);privateResponse(r);
  assert.equal(x.operations.includes("ADMIN_CREATED"),false);
  assert.doesNotMatch(await r.text(),/PRIVATE_AUTH/);
 });
 test("draft "+method+" does not create admin client when Auth throws",async()=>{
  const x=runRoute(draft,{authThrows:true});
  const r=await invoke(x.handlers);
  assert.equal(r.status,503);privateResponse(r);
  assert.equal(x.operations.includes("ADMIN_CREATED"),false);
  assert.doesNotMatch(await r.text(),/PRIVATE_AUTH/);
 });
}
