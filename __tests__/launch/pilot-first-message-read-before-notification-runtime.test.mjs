import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const U="11111111-1111-4111-8111-111111111111";
const C="22222222-2222-4222-8222-222222222222";
const M="33333333-3333-4333-8333-333333333333";
const R="44444444-4444-4444-8444-444444444444";
const route="app/api/messages/send/route.ts";
function scenario({firstReadError=false,firstIsCurrent=true,notificationError=false}={}){
 const steps=[];
 const makeQuery=table=>{
   let mode="regular", filterId=null;
   const response=()=>{
     if(table==="conversations")return {data:{id:C,listing_id:C,buyer_id:U,seller_id:R},error:null};
     if(table==="messages"){
       if(mode==="first"){
         steps.push("FIRST_MESSAGE_READ");
         return firstReadError?
           {data:null,error:{message:"PRIVATE_RLS_OR_SQL_DETAIL"}}:
           {data:{id:firstIsCurrent?M:"55555555-5555-4555-8555-555555555555"},error:null};
       }
       return{data:{id:M,conversation_id:C,sender_id:U,body:"synthetic message"},error:null};
     }
     if(table==="listings")return {data:{title:"Synthetic listing"},error:null};
     if(table==="profiles")return {data:{full_name:filterId===R?"Recipient":"Sender"},error:null};
     throw Error("Unexpected query "+table);
   };
   const q=new Proxy({}, {get(_obj,name){
     if(name==="eq")return(col,value)=>{if(col==="conversation_id") mode="first";if(col==="id") filterId=value;return q;};
     if(name==="maybeSingle"||name==="single")return async()=>response();
     if(name==="then")return(res,rej)=>Promise.resolve(response()).then(res,rej);
     return()=>q;
   }});
   return q;
 };
 const db={from:makeQuery};
 const admin={...db,auth:{admin:{getUserById:async()=>({data:{user:{id:R,email:"recipient@example.invalid"}},error:null})}}};
 const supabase={...db,auth:{getUser:async()=>({data:{user:{id:U,user_metadata:{}}}})}};
 const mods={
  "next/server":{NextResponse:{json:(data,opts={})=>new Response(JSON.stringify(data),{status:opts.status??200,headers:opts.headers??{}})}},
  "@/lib/supabase/server":{createClient:async()=>supabase},
  "@/lib/supabase/admin":{createAdminClient:()=>admin},
  "@/lib/notifications":{createNotificationOnce:async()=>{
    steps.push("NOTIFICATION");
    return {error:notificationError?{message:"PRIVATE_WRITE_ERROR"}:null};
  }},
  "@/lib/emails/mvp-event-emails":{sendFirstMessageEmail:async()=>{steps.push("SEND_EMAIL");}},
  "@/lib/emails/delivery-idempotency":{sendTransactionalEmailOnce:async(_client,params)=>{
    steps.push("EMAIL");
    return params.send();
  }}
 };
 const code=ts.transpileModule(readFileSync(route,"utf8"),{fileName:route,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((code.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exp={};const logs=[];
 vm.runInNewContext(code.outputText,{exports:exp,require:n=>mods[n]??{},
   Date,Promise,Request,Response,console:{error:(...args)=>logs.push(args)}},{filename:route,timeout:1500});
 return {steps,logs,call:()=>exp.POST(new Request("https://fixture.invalid/api/messages/send",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({conversationId:C,messageId:M})
 }))};
}
test("failed first-message query must not create notification or email",async()=>{
 const f=scenario({firstReadError:true});const res=await f.call();
 assert.equal(res.status,503);assert.equal(res.headers.get("cache-control"),"private, no-store");
 assert.deepEqual(f.steps,["FIRST_MESSAGE_READ"]);
 assert.deepEqual(f.logs,[["message_first_message_lookup_failed"]]);
 assert.doesNotMatch(await res.text(),/PRIVATE_/);
});
test("successful first message is read before notification, then sends email",async()=>{
 const f=scenario();const res=await f.call();
 assert.equal(res.status,200);assert.deepEqual(await res.json(),{ok:true});
 assert.deepEqual(f.steps,["FIRST_MESSAGE_READ","NOTIFICATION","EMAIL","SEND_EMAIL"]);
});
test("non-first sender message notifies, without resending first-message email",async()=>{
 const f=scenario({firstIsCurrent:false});const res=await f.call();
 assert.equal(res.status,200);
 assert.deepEqual(f.steps,["FIRST_MESSAGE_READ","NOTIFICATION"]);
});
test("notification write failure cannot dispatch email",async()=>{
 const f=scenario({notificationError:true});const res=await f.call();
 assert.equal(res.status,500);
 assert.deepEqual(f.steps,["FIRST_MESSAGE_READ","NOTIFICATION"]);
 assert.equal(res.headers.get("cache-control"),"private, no-store");
 assert.doesNotMatch(await res.text(),/PRIVATE_/);
});
