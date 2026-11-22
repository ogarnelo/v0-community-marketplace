import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const ts=createRequire(import.meta.url)("typescript");
const routePath="app/api/agreements/confirm/route.ts";
const candidatePath="scripts/review_only/r3_agreements_confirm_cancel_a025_a026_candidate.sql";
const candidate=readFileSync(candidatePath,"utf8");
const pg17=readFileSync("scripts/qa/r3-agreements-confirm-cancel-a025-a026-pg17.sh","utf8");
const agreementId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function fixture({row=null,error=null,authError=null,guest=false}={}){
 const calls=[];
 const admin={
   rpc:async(name,params)=>{
     calls.push("RPC");
     assert.equal(name,"server_confirm_agreement");
     assert.equal(params.p_actor_id,userId);
     assert.equal(params.p_agreement_id,agreementId);
     return {data:row,error};
   },
   from:()=>{calls.push("READ");throw Error("Unexpected post-RPC effects");},
 };
 const mods={
   "next/server":{NextResponse:{json:(b,o={})=>new Response(JSON.stringify(b),{status:o.status??200,headers:o.headers??{}})}},
   "@/lib/supabase/server":{createClient:async()=>({
       auth:{getUser:async()=>({data:{user:guest?null:{id:userId,user_metadata:{}}},error:authError})}
   })},
   "@/lib/supabase/admin":{createAdminClient:()=>{calls.push("ADMIN");return admin;}},
   "@/lib/emails/mvp-event-emails":{},
   "@/lib/growth/server-attribution":{},
   "@/lib/notifications":{},
   "@/lib/emails/delivery-idempotency":{},
   "@/lib/demand/need-attribution":{},
   "@/lib/analytics/product-events.server":{},
   "@/lib/seo/demo-listing":{},
 };
 const output=ts.transpileModule(readFileSync(routePath,"utf8"),{
   fileName:routePath,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 });
 assert.equal((output.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 const exp={};
 vm.runInNewContext(output.outputText,{
   exports:exp,require:(name)=>{
     assert.ok(Object.hasOwn(mods,name),"unexpected module "+name);
     return mods[name];
   }, Request,Response,URL,Date,Promise,console:{error:()=>{}}
 },{filename:routePath,timeout:1800});
 return {calls,async run(){
   const res=await exp.POST(new Request("https://example.invalid/api/agreements/confirm",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({agreementId})
   }));
   return {status:res.status,body:await res.json(),cache:res.headers.get("cache-control")};
 }};
}

for(const [label,data] of [
 ["null result",null],
 ["empty row array",[]],
 ["multiple result rows",[{id:agreementId,status:"confirmed",buyer_id:userId,seller_id:otherId},{id:agreementId,status:"confirmed"}]],
 ["different agreement",[{id:otherId,status:"confirmed",buyer_id:userId,seller_id:otherId}]],
 ["not-yet-confirmed row",[{id:agreementId,status:"proposed",buyer_id:userId,seller_id:otherId}]],
 ["not a participant",[{id:agreementId,status:"confirmed",buyer_id:otherId,seller_id:otherId}]],
 ["malformed row",[{}]],
]){
 test("A-025 confirm "+label+" fails closed before postcommit effects",async()=>{
   const f=fixture({row:data});
   const r=await f.run();
   assert.equal(r.status,503);
   assert.equal(r.cache,"private, no-store");
   assert.notEqual(r.body.ok,true);
   assert.equal(f.calls.includes("READ"),false);
   assert.equal(f.calls.filter(s=>s==="RPC").length,1);
 });
}

for(const msg of ["Listing no longer accepts agreement confirmation","Listing already allocated outside this agreement"]){
 test("A-025 SQL listing conflicts map to private HTTP 409",async()=>{
   const f=fixture({error:{message:msg}});
   const r=await f.run();
   assert.equal(r.status,409);
   assert.equal(r.cache,"private, no-store");
   assert.equal(f.calls.includes("READ"),false);
 });
}
test("A-025 auth must deny guest before privileged client",async()=>{
 const f=fixture({guest:true});const r=await f.run();
 assert.equal(r.status,401);assert.equal(f.calls.includes("ADMIN"),false);
});
test("A-025 auth provider error does not become anonymous 401",async()=>{
 const f=fixture({authError:{message:"PRIVATE_SQL",name:"ProviderUnavailable"}});const r=await f.run();
 assert.equal(r.status,503);assert.equal(f.calls.includes("ADMIN"),false);
});

test("A-025/A-026 candidate SQL remains review-only and preserves existing authorizations",()=>{
 assert.match(candidate,/SQL CANDIDATE REVIEW ONLY, NOT INSTALLED/);
 assert.match(candidate,/NO_GO_A025_A026_SCHEMA_DRIFT/);
 assert.match(candidate,/NO_GO_A025_DUPLICATE_CONFIRMED/);
 assert.match(candidate,/Listing no longer accepts agreement confirmation/);
 assert.match(candidate,/Listing already allocated outside this agreement/);
 assert.match(candidate,/Listing not found for agreement cancellation/);
 assert.match(candidate,/a\.status in \('proposed','buyer_confirmed','seller_confirmed','confirmed','disputed'\)/);
 assert.match(candidate,/o\.status='accepted'/);
 assert.match(candidate,/d\.status in \('approved','completed'\)/);
 assert.match(candidate,/NO_GO_A025_A026_ACL_DRIFT/);
 assert.match(candidate,/BEGIN;[\s\S]*COMMIT;/);
 assert.equal((candidate.match(/CREATE OR REPLACE FUNCTION public\.server_/g)||[]).length,2);
 assert.doesNotMatch(candidate,/SECURITY DEFINER|ALTER POLICY|CREATE POLICY|DROP POLICY|DROP INDEX|GRANT ALL/);
});
test("A-025/A-026 PG17 harness uses only a disposable local postgres server",()=>{
 assert.match(pg17,/PGHOST=127\.0\.0\.1/);
 assert.match(pg17,/wetudy_r3_agreements_synthetic/);
 assert.match(pg17,/expected exactly one winner/);
 assert.match(pg17,/concurrent proposal reopened listing/);
 assert.match(pg17,/accepted offer allowed second confirmation/);
 assert.doesNotMatch(pg17,/supabase\.co|wetudy\.com/);
});
