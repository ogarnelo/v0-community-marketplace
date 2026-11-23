import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";

const ts=createRequire(import.meta.url)("typescript");
const serviceFile="lib/services/donations.service.ts";
const routeFile="app/api/donations/request/route.ts";
const L="11111111-1111-4111-8111-111111111111";
const U="22222222-2222-4222-8222-222222222222";
const SELLER="33333333-3333-4333-8333-333333333333";
const SCHOOL="44444444-4444-4444-8444-444444444444";
const REQUEST="55555555-5555-4555-8555-555555555555";
const CHAT="66666666-6666-4666-8666-666666666666";
const EVENT="77777777-7777-4777-8777-777777777777";

function evaluate(file,imports){
 const output=ts.transpileModule(readFileSync(file,"utf8"),{
   fileName:file,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}
 });
 assert.equal((output.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 const exports={};
 vm.runInNewContext(output.outputText,{
   exports,require:(name)=>{
     assert.ok(Object.hasOwn(imports,name),"Unexpected dependency "+name);
     return imports[name];
   },
   Promise,Date,Error,Object,Number,Request,Response,URL,
   console:{error:()=>{}},
 },{filename:file,timeout:1600});
 return exports;
}
function fixture(opts={}){
 const calls=[];
 let donationReads=0;
 const existing={
   id:REQUEST,listing_id:L,requester_id:opts.foreignRequester?SELLER:U,
   school_id:SCHOOL,status:"pending",note:"Nota del primer envío",
 };
 const listing={
   id:L,title:"Donación sintética",seller_id:SELLER,school_id:SCHOOL,
   status:"available",type:"donation",listing_type:"donation",
 };
 const chat={
   id:CHAT,listing_id:L,buyer_id:opts.foreignChat?SELLER:U,seller_id:SELLER,
 };
 const event={
   id:EVENT,request_id:REQUEST,conversation_id:opts.foreignEventChat?L:CHAT,
   actor_id:opts.foreignEventActor?SELLER:U,
   event_type:"request_created",status_snapshot:opts.wrongEventStatus?"approved":"pending",
   note:existing.note,
 };
 const expectedBody=[EVENT,REQUEST,"request_created","pending",existing.note].join("|");
 const rows=(table,filters,contains)=>{
   if(table==="donation_request_events"){
     if(opts.missingStage==="event")return [];
     return opts.duplicateStage==="event"?[event,event]:[event];
   }
   if(table==="messages"){
     assert.equal(filters.conversation_id,CHAT);
     assert.equal(filters.sender_id,U);
     assert.equal(filters.body,expectedBody);
     if(opts.missingStage==="message")return [];
     return opts.duplicateStage==="message"?[{id:EVENT},{id:EVENT}]:[{id:EVENT}];
   }
   if(table==="notifications"){
     assert.equal(filters.user_id,SELLER);
     assert.equal(filters.kind,"donation_requested");
     assert.equal(filters.href,"/messages/"+CHAT);
     assert.equal(contains?.listing_id,L);
     assert.equal(contains?.donation_request_id,REQUEST);
     assert.equal(contains?.conversation_id,CHAT);
     if(opts.missingStage==="notification")return [];
     return opts.duplicateStage==="notification"?[{id:EVENT},{id:EVENT}]:[{id:EVENT}];
   }
   throw Error("Unexpected list "+table);
 };
 const client={from(table){
   calls.push("READ_TABLE:"+table);
   let mode="read",filters={},metadata=null;
   const q={
     select:()=>q,
     eq:(name,value)=>{filters[name]=value;return q;},
     contains:(name,value)=>{assert.equal(name,"metadata");metadata=value;return q;},
     limit:(n)=>{assert.equal(n,2);return q;},
     maybeSingle:async()=>{
       if(table==="listings"){
         assert.equal(filters.id,L);
         return {data:listing,error:null};
       }
       if(table==="donation_requests"){
         assert.equal(filters.listing_id,L);
         assert.equal(filters.requester_id,U);
         assert.equal(filters.status,"pending");
         donationReads++;
         return {data:opts.race&&donationReads===1?null:existing,error:null};
       }
       if(table==="conversations"){
         assert.equal(filters.listing_id,L);
         assert.equal(filters.buyer_id,U);
         assert.equal(filters.seller_id,SELLER);
         return {data:opts.missingStage==="chat"?null:chat,error:null};
       }
       throw Error("Unexpected one "+table);
     },
     insert:()=>{mode="insert";calls.push("INSERT:"+table);return q;},
     single:async()=>{
       assert.equal(table,"donation_requests");
       assert.equal(mode,"insert");
       return {data:null,error:{code:"23505",message:"duplicate key value violates unique constraint donation_requests_one_pending_per_requester_listing_idx"}};
     },
     then:(resolve,reject)=>{
       calls.push("READ_ROWS:"+table);
       const v={data:rows(table,filters,metadata),error:opts.errorStage===table?{message:"PRIVATE_DB_ERROR"}:null};
       return Promise.resolve(v).then(resolve,reject);
     },
   };
   return q;
 }};
 const mocks={
   "@/lib/marketplace/rules":{canRequestDonation:()=>({ok:true})},
   "@/lib/notifications":{
     createNotification:()=>{throw Error("UNEXPECTED_NOTIFICATION");},
     createNotificationOnce:()=>{throw Error("UNEXPECTED_NOTIFICATION_ONCE");},
   },
   "@/lib/donations/chat-message":{buildDonationChatBody:({eventId,requestId,eventType,status,note})=>
     [eventId,requestId,eventType,status,note].join("|")},
   "@/lib/services/conversations.service":{getOrCreateConversation:async()=>{throw Error("UNEXPECTED_CHAT_WRITE");}},
 };
 const exports=evaluate(serviceFile,mocks);
 return {calls,run:()=>exports.requestDonationFlow({
   supabase:client,listingId:L,actorUserId:U,note:"El reintento no debe sustituir la nota original",
 })};
}
test("A-039: completed duplicate is read-only, acknowledges original IDs",async()=>{
 const f=fixture(),r=await f.run();
 assert.equal(r.requestId,REQUEST);
 assert.equal(r.conversationId,CHAT);
 assert.equal(r.replayed,true);
 assert.ok(f.calls.includes("READ_ROWS:donation_request_events"));
 assert.ok(f.calls.includes("READ_ROWS:messages"));
 assert.ok(f.calls.includes("READ_ROWS:notifications"));
 assert.ok(!f.calls.some(x=>x.startsWith("INSERT:")));
});
test("A-039: unique pending race can acknowledge completed winner read-only",async()=>{
 const f=fixture({race:true}),r=await f.run();
 assert.equal(r.requestId,REQUEST);
 assert.equal(r.replayed,true);
 assert.equal(f.calls.filter(x=>x==="INSERT:donation_requests").length,1);
 assert.ok(!f.calls.includes("INSERT:messages"));
});
for(const [title,opts] of [
 ["missing chat",{missingStage:"chat"}],
 ["missing event",{missingStage:"event"}],
 ["missing message",{missingStage:"message"}],
 ["missing notification",{missingStage:"notification"}],
 ["duplicate events",{duplicateStage:"event"}],
 ["duplicate messages",{duplicateStage:"message"}],
 ["duplicate notifications",{duplicateStage:"notification"}],
 ["foreign actor",{foreignEventActor:true}],
 ["foreign event conversation",{foreignEventChat:true}],
 ["wrong event status",{wrongEventStatus:true}],
 ["foreign pending owner",{foreignRequester:true}],
 ["foreign chat buyer",{foreignChat:true}],
 ["provider failure",{errorStage:"messages"}],
]){
 test("A-039: "+title+" refuses false acknowledgement and any write",async()=>{
   const f=fixture(opts);
   await assert.rejects(f.run(),x=>x.name==="DonationRequestReconciliationError");
   assert.ok(!f.calls.some(x=>x.startsWith("INSERT:")));
 });
}
test("A-039: safe replay does not repeat attribution or expose internal state",async()=>{
 const calls=[];
 const mocks={
   "next/server":{NextResponse:{json:(body,options={})=>new Response(JSON.stringify(body),{
     status:options.status??200,headers:options.headers??{}
   })}},
   "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({
     data:{user:{id:U}},error:null
   })}})},
   "@/lib/supabase/admin":{createAdminClient:()=>({})},
   "@/lib/services/donations.service":{requestDonationFlow:async()=>{
     calls.push("SERVICE");return {requestId:REQUEST,conversationId:CHAT,replayed:true};
   }},
   "@/lib/demand/need-attribution":{attributeNeedToConversation:async()=>{
     calls.push("ATTRIBUTION");throw Error("Replay unexpectedly wrote attribution");
   }},
 };
 const route=evaluate(routeFile,mocks);
 const res=await route.POST(new Request("https://fixture.invalid/api/donations/request",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({listingId:L}),
 }));
 assert.equal(res.status,200);
 assert.equal(res.headers.get("cache-control"),"private, no-store");
 const json=await res.json();
 assert.deepEqual(json,{ok:true,requestId:REQUEST,conversationId:CHAT});
 assert.equal(calls.includes("ATTRIBUTION"),false);
});
test("A-039: first notification uses preexisting event-key unique constraint",()=>{
 const source=readFileSync(serviceFile,"utf8");
 assert.match(source,/createNotificationOnce\(supabase,/);
 assert.match(source,/event_key: "donation-request:" \+ donationRequest\.id \+ ":created"/);
 assert.match(source,/DonationRequestReconciliationError/);
 assert.doesNotMatch(source,/from\("messages"\)\.upsert/);
});
