import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const FILE="lib/services/donations.service.ts";
const ROUTE="app/api/donations/request/route.ts";
const L="11111111-1111-4111-8111-111111111111";
const A="22222222-2222-4222-8222-222222222222";
const S="33333333-3333-4333-8333-333333333333";
const SCHOOL="44444444-4444-4444-8444-444444444444";
const R="55555555-5555-4555-8555-555555555555";
const C="66666666-6666-4666-8666-666666666666";
function evaluate(path,modules,env){
 const src=readFileSync(path,"utf8");
 const output=ts.transpileModule(src,{fileName:path,reportDiagnostics:true,
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 assert.equal((output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 const exp={};
 vm.runInNewContext(output.outputText,{exports:exp,
   require:k=>{assert.ok(Object.hasOwn(modules,k),"Unexpected dependency "+k);return modules[k]},
   process:{env:env??{}},Promise,Date,Error,Object,Number,Request,Response,URL,
   console:{error:()=>{}}
 },{filename:path,timeout:2200});
 return exp;
}
function serviceFixture({existing=false,collision=false,rpcError=false,row=null}={}){
 const calls=[],listing={id:L,title:"Donación",seller_id:S,school_id:SCHOOL,status:"available",
   listing_type:"donation",type:"donation"};
 const pending={id:R,listing_id:L,requester_id:A,school_id:SCHOOL,status:"pending",note:null};
 let pendingReads=0;
 const client={
   from(table){
     calls.push("FROM:"+table);let mode="read";
     const q={select:()=>q,eq:()=>q,
       maybeSingle:async()=>{
         if(table==="listings")return {data:listing,error:null};
         if(table==="donation_requests"){pendingReads++;return {
           data:(existing||collision&&pendingReads>=2)?pending:null,error:null
         }}
         throw Error("unexpected read "+table);
       },
       insert:()=>{calls.push("INSERT:"+table);mode="insert";return q},
       single:async()=>{
         assert.equal(mode,"insert");assert.equal(table,"donation_requests");
         return collision?{data:null,error:{
           code:"23505",message:"donation_requests_one_pending_per_requester_listing_idx"
         }}:{data:pending,error:null}
       }
     };return q;
   },
   rpc:async(name,params)=>{
     calls.push("RPC:"+name);
     assert.equal(params.p_request_id,R);assert.equal(params.p_actor_id,A);
     return {data:row??[{request_id:R,conversation_id:C}],
       error:rpcError?{message:"PRIVATE_DB_FAILURE"}:null};
   }
 };
 const exports=evaluate(FILE,{
   "@/lib/marketplace/rules":{canRequestDonation:()=>({ok:true})},
   "@/lib/notifications":{createNotification:()=>{throw Error("LEGACY_NOTIFY")},
                           createNotificationOnce:()=>{throw Error("LEGACY_NOTIFY")}},
   "@/lib/donations/chat-message":{buildDonationChatBody:()=>{throw Error("LEGACY_CHAT_BODY")}},
   "@/lib/services/conversations.service":{getOrCreateConversation:()=>{throw Error("LEGACY_CONVERSATION")}}
 });
 return {calls,run:()=>exports.requestDonationFlow({supabase:client,
   listingId:L,actorUserId:A,note:null,enableAtomicReconciliation:true})};
}
for(const [title,scenario,replayed] of [
 ["new request",{existing:false},false],
 ["existing partial request",{existing:true},true],
 ["23505 winner",{collision:true},true],
]){
 test("A-039b "+title+" invokes RPC only once; no legacy writes",async()=>{
   const h=serviceFixture(scenario),result=await h.run();
   assert.equal(result.requestId,R);assert.equal(result.conversationId,C);
   assert.equal(result.replayed,replayed);
   assert.equal(h.calls.filter(x=>x==="RPC:r3_reconcile_donation_request_atomic").length,1);
   assert.equal(h.calls.includes("INSERT:donation_request_events"),false);
   assert.equal(h.calls.includes("INSERT:notifications"),false);
   assert.equal(h.calls.includes("INSERT:messages"),false);
 });
}
for(const [label,config] of [
 ["provider RPC failure",{existing:true,rpcError:true}],
 ["empty response",{existing:true,row:[]}],
 ["two rows",{existing:true,row:[{request_id:R,conversation_id:C},{request_id:R,conversation_id:C}]}],
 ["wrong request ID",{existing:true,row:[{request_id:L,conversation_id:C}]}],
 ["malformed conversation ID",{existing:true,row:[{request_id:R,conversation_id:"forged"}]}]
]){
 test("A-039b "+label+" fails closed without retrying legacy writes",async()=>{
   const h=serviceFixture(config);
   await assert.rejects(h.run(),x=>x.name==="DonationRequestReconciliationError");
   assert.equal(h.calls.filter(x=>x.startsWith("RPC:")).length,1);
   assert.equal(h.calls.includes("INSERT:donation_request_events"),false);
 });
}
for(const value of ["true","false","1",""]){
 test("A-039b route flag "+JSON.stringify(value)+" is explicit",async()=>{
   const calls=[];
   const mods={
     "next/server":{NextResponse:{json:(body,opts={})=>new Response(JSON.stringify(body),{
       status:opts.status??200,headers:opts.headers??{}
     })}},
     "@/lib/supabase/server":{createClient:async()=>({auth:{
       getUser:async()=>({data:{user:{id:A}},error:null})
     }})},
     "@/lib/supabase/admin":{createAdminClient:()=>({})},
     "@/lib/services/donations.service":{requestDonationFlow:async args=>{
       calls.push(args.enableAtomicReconciliation);
       return {requestId:R,conversationId:C,replayed:true};
     }},
     "@/lib/demand/need-attribution":{attributeNeedToConversation:async()=>{
       throw Error("must not repeat on replay");
     }}
   };
   const x=evaluate(ROUTE,mods,{WETUDY_R3_DONATION_REQUEST_REPAIR_ENABLED:value});
   const req=new Request("https://fixture.invalid/api/donations/request",{
     method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({listingId:L})
   });
   const res=await x.POST(req);assert.equal(res.status,200);
   assert.equal(res.headers.get("cache-control"),"private, no-store");
   assert.equal(calls.length,1);assert.equal(calls[0],value==="true");
   assert.deepEqual(await res.json(),{ok:true,requestId:R,conversationId:C});
 });
}
test("A-039b SQL stays review-only, service-only and uses row locks and fences",()=>{
 const sql=readFileSync("scripts/review_only/r3_donation_request_reconcile_atomic_a039b_candidate.sql","utf8");
 assert.match(sql,/REVIEW ONLY, NOT AN AUTOMATIC MIGRATION/);
 assert.match(sql,/NO_GO_A039B_SCHEMA_OR_EXISTING_GUARDS_DRIFTED/);
 assert.match(sql,/CREATE UNIQUE INDEX donation_request_events_request_created_once_idx/);
 assert.match(sql,/CREATE UNIQUE INDEX messages_donation_event_once_idx/);
 assert.match(sql,/SECURITY INVOKER SET search_path=''/);
 assert.match(sql,/FROM public.listings l[\s\S]*?FOR UPDATE/);
 assert.match(sql,/FROM public.donation_requests d[\s\S]*?FOR UPDATE/);
 assert.match(sql,/ON CONFLICT\(event_key\) DO NOTHING/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public.r3_reconcile_donation_request_atomic/);
 assert.match(sql,/NO_GO_A039B_POSTFLIGHT/);
 assert.doesNotMatch(sql,/SECURITY DEFINER|ALTER POLICY|CREATE POLICY|DROP POLICY|DROP TABLE|TRUNCATE/);
});
test("A-039b PG17 harness uses disposable local Postgres, never WETUDY production",()=>{
 const s=readFileSync("scripts/qa/r3-donation-request-reconcile-atomic-pg17.sh","utf8");
 assert.match(s,/PGHOST=127\.0\.0\.1/);
 assert.match(s,/wetudy_r3_a039b_synthetic/);
 assert.match(s,/QA_BLOCK_NOTIFICATION/);
 assert.match(s,/parallel\(\)/);
 assert.match(s,/UNIQUE event-ID message fence/);
 assert.doesNotMatch(s,/supabase\.co|DATABASE_URL/);
});
