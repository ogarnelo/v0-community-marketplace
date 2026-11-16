import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const ID="11111111-1111-4111-8111-111111111111";
const OTHER="22222222-2222-4222-8222-222222222222";
function runtime(action,opts={}){
 const calls=[],exp={},user={id:ID,email:"admin@example.invalid"};
 const auth={auth:{getUser:async()=>({data:{user},error:null})},
  from:()=>{const q={select:()=>q,eq:()=>q,then:(a,b)=>Promise.resolve({
   data:[{role:"school_admin",school_id:ID}],error:null
  }).then(a,b)};return q;}};
 const admin={from:(table)=>{
  const mode={op:"read",table},q={};
  const db=()=>({
   data:
    table==="donation_requests"?{id:ID,listing_id:ID,requester_id:ID,school_id:ID,status:"pending"}:
    table==="listings"?{id:ID,title:"QA",seller_id:OTHER,school_id:ID}:
    table==="conversations"?{id:ID}:null,
   error:null
  });
  q.select=()=>q;
  q.eq=(key,value)=>{
   calls.push("EQ:"+table+":"+key+":"+value);
   return q;
  };
  q.neq=()=>q;
  q.maybeSingle=async()=>{
   if(mode.op==="update-primary")return {data:{id:ID},error:null};
   return db();
  };
  q.update=()=>{
   mode.op=table==="donation_requests"?"update-primary":"update";
   calls.push("UPDATE:"+table);
   return q;
  };
  q.insert=async()=>{
   calls.push("INSERT:"+table);
   return {error:table==="messages"&&opts.messageError?{message:"PRIVATE_MESSAGE"}:null};
  };
  q.then=(resolve,reject)=>{
   let err=null;
   if(mode.op==="update"){
     if(table==="listings"&&opts.archiveError)err={message:"PRIVATE_ARCHIVE"};
     if(table==="conversations"&&opts.conversationError)err={message:"PRIVATE_CONVERSATION"};
   }
   if(table==="donation_requests"&&mode.op==="update-primary"&&
     calls.some(x=>x==="EQ:donation_requests:listing_id:"+ID)&&opts.competitorsError)
      err={message:"PRIVATE_COMPETITORS"};
   return Promise.resolve({error:err}).then(resolve,reject);
  };
  calls.push("FROM:"+table);
  return q;
 }};
 const mocks={
  "next/server":{NextResponse:{json:(body,o={})=>new Response(JSON.stringify(body),{
    status:o.status??200,headers:o.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>auth},
  "@/lib/supabase/admin":{createAdminClient:()=>admin},
  "@/lib/admin/roles":{getAdminFlags:()=>({
   canAccessAdmin:true,isSuperAdmin:false,schoolAdminSchoolId:ID
  })},
  "@/lib/notifications":{createNotifications:async()=>{
   calls.push("NOTIFY");return {error:opts.notificationError?{message:"PRIVATE_NOTIFICATION"}:null};
  }}
 };
 const path="app/api/donations/review/route.ts",src=readFileSync(path,"utf8");
 const out=ts.transpileModule(src,{fileName:path,reportDiagnostics:true,compilerOptions:{
   target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true
 }});
 assert.equal((out.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 vm.runInNewContext(out.outputText,{exports:exp,require:name=>mocks[name]??{},Date,Promise,Request,Response,
   console:{error:()=>{}}},{filename:path,timeout:1500});
 return {calls,run:async()=>{
  const r=await exp.POST(new Request("https://fixture.invalid/api",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({donationRequestId:ID,action})
  }));
  return {status:r.status,cache:r.headers.get("cache-control"),body:await r.json()};
 }};
}
for(const [action,opts,expected,absent] of [
 ["approve",{},200,null],
 ["approve",{competitorsError:true},503,"UPDATE:listings"],
 ["approve",{archiveError:true},503,"INSERT:messages"],
 ["approve",{messageError:true},503,"NOTIFY"],
 ["approve",{conversationError:true},503,"NOTIFY"],
 ["approve",{notificationError:true},503,null],
 ["reject",{},200,null],
 ["reject",{messageError:true},503,"NOTIFY"],
 ["reject",{conversationError:true},503,"NOTIFY"],
 ["reject",{notificationError:true},503,null]
]){
 test(action+" "+JSON.stringify(opts)+" => "+expected,async()=>{
  const h=runtime(action,opts),r=await h.run();
  assert.equal(r.status,expected);assert.equal(r.cache,"private, no-store");
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_/);
  if(absent)assert.equal(h.calls.includes(absent),false);
  if(expected===503)assert.match(r.body.error,/conciliar|conciliación/);
 });
}
test("cuerpo de nota limitado y ningún efecto secundario posterior se ignora",()=>{
 const s=readFileSync("app/api/donations/review/route.ts","utf8");
 assert.match(s,/note\.trim\(\)\.slice\(0, 600\)/);
 assert.match(s,/if \(competitorsError\)/);
 assert.match(s,/if \(archiveError\)/);
 assert.equal((s.match(/if \(messageError\)/g)||[]).length,2);
 assert.equal((s.match(/if \(conversationUpdateError\)/g)||[]).length,2);
 assert.equal((s.match(/if \(notifyError\)/g)||[]).length,2);
});
