import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const UID="11111111-1111-4111-8111-111111111111";
const CID="22222222-2222-4222-8222-222222222222";
const MID="33333333-3333-4333-8333-333333333333";
const TO="44444444-4444-4444-8444-444444444444";
const route="app/api/messages/send/route.ts";
function fixture(failOn=null){
  const events=[];
  const dataFor=(table,filter)=>{
    if(table==="conversations")return {id:CID,listing_id:CID,buyer_id:UID,seller_id:TO};
    if(table==="messages")return {id:MID,conversation_id:CID,sender_id:UID,body:"synthetic text"};
    if(table==="listings")return {title:"synthetic book"};
    if(table==="profiles")return {full_name:filter===TO?"synthetic recipient":"synthetic sender"};
    return null;
  };
  const from=table=>{
    let filter=null;events.push("query:"+table);
    const q=new Proxy({}, {get(_t,name){
      if(name==="eq")return(field,value)=>{if(field==="id")filter=value;return q};
      if(name==="then")return(resolve,reject)=>Promise.resolve({
        data:dataFor(table,filter),
        error:(failOn===table || (failOn==="senderProfile"&&table==="profiles"&&filter===UID)
        || (failOn==="recipientProfile"&&table==="profiles"&&filter===TO))?
          {message:"PRIVATE_SQL_DIAGNOSTIC"}:null
      }).then(resolve,reject);
      if(name==="single"||name==="maybeSingle")return async()=>({
        data:dataFor(table,filter),
        error:(failOn===table || (failOn==="senderProfile"&&table==="profiles"&&filter===UID)
        || (failOn==="recipientProfile"&&table==="profiles"&&filter===TO))?
          {message:"PRIVATE_SQL_DIAGNOSTIC"}:null
      });
      return()=>q;
    }});
    return q;
  };
  const admin={from,auth:{admin:{getUserById:async()=>{
    events.push("recipientAuth");
    return failOn==="auth"?{data:null,error:{message:"PRIVATE_AUTH_DIAGNOSTIC"}}:
       {data:{user:{email:"test@example.invalid"}},error:null};
  }}}};
  const supabase={auth:{getUser:async()=>({data:{user:{id:UID,user_metadata:{}}}})},
    from};
  const mocks={
    "next/server":{NextResponse:{json:(data,opts={})=>new Response(JSON.stringify(data),
       {status:opts.status??200,headers:opts.headers??{}})}},
    "@/lib/supabase/server":{createClient:async()=>supabase},
    "@/lib/supabase/admin":{createAdminClient:()=>admin},
    "@/lib/notifications":{createNotificationOnce:async()=>{
      events.push("NOTIFICATION_WRITTEN");return{error:null};
    }},
    "@/lib/emails/mvp-event-emails":{sendFirstMessageEmail:async()=>{}},
    "@/lib/emails/delivery-idempotency":{sendTransactionalEmailOnce:async()=>{
      events.push("EMAIL_SENT");return{};
    }}
  };
  const transpiled=ts.transpileModule(readFileSync(route,"utf8"),{
    fileName:route,reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
  });
  assert.equal((transpiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  const exports={};const logs=[];
  vm.runInNewContext(transpiled.outputText,{
    exports,require:x=>mocks[x]??{},Date,Promise,Request,Response,
    console:{error:(...args)=>logs.push(args)}
  },{filename:route,timeout:1500});
  return{events,logs,run:()=>exports.POST(new Request("https://fixture.invalid/send",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({conversationId:CID,messageId:MID})
  }))};
}
for(const failure of ["listings","recipientProfile","senderProfile","auth"]){
  test("failed "+failure+" lookup rejects notification before any write",async()=>{
    const f=fixture(failure);
    const res=await f.run();
    assert.equal(res.status,503);
    assert.equal(res.headers.get("cache-control"),"private, no-store");
    assert.equal(f.events.includes("NOTIFICATION_WRITTEN"),false);
    assert.equal(f.events.includes("EMAIL_SENT"),false);
    assert.doesNotMatch(await res.text(),/PRIVATE_/);
    assert.deepEqual(f.logs,[["message_notification_recipient_lookup_failed"]]);
  });
}
test("successful lookups create notification after verified recipient identity",async()=>{
  const f=fixture();
  const res=await f.run();
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true});
  const auth=f.events.indexOf("recipientAuth");
  const notification=f.events.indexOf("NOTIFICATION_WRITTEN");
  assert.ok(auth>=0 && notification>auth);
  assert.equal(res.headers.get("cache-control"),"private, no-store");
});
