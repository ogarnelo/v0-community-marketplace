import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const source=readFileSync("app/api/cron/marketplace-alert-outbox/route.ts","utf8");
const matcher=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
const sql=readFileSync("docs/pilot/sql/p0_alert_pause_outbox_review_only_20261119.sql","utf8");
const LISTING="11111111-1111-4111-8111-111111111111";
const LEASE="22222222-2222-4222-8222-222222222222";
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
},fileName:"alert-outbox.ts"}).outputText;
function run({pauseOk=true,pauseError=false}={}){
 const events=[];
 const admin={
   from(table){
     events.push("TABLE:"+table);
     if(table==="marketplace_alert_email_intents")return {
       select(){return this},async limit(){return {data:[],error:null}},
     };
     if(table==="marketplace_alert_outbox")return {
       select(){return this},eq(){return this},
       async maybeSingle(){return {data:{discovery_completed_at:"2026-11-19T00:00:00Z"},error:null}},
     };
     if(table==="listings")return {
       select(){return this},eq(){return this},
       async maybeSingle(){return {data:{id:LISTING,status:"available",is_demo:false},error:null}},
     };
     if(table==="listing_photos")return {
       select(){return this},eq(){return this},
       then(ok,bad){return Promise.resolve({count:1,error:null}).then(ok,bad)},
     };
     throw Error("Unexpected DB table "+table);
   },
   async rpc(name,args){
     events.push("RPC:"+name);
     if(name==="marketplace_alert_email_intent_health_v1")return {data:[],error:null};
     if(name==="marketplace_alert_review_count_v1")return {data:0,error:null};
     if(name==="marketplace_alert_reconciliation_health_v1")return {data:[],error:null};
     if(name==="marketplace_alert_claim_outbox_v1")return {
       data:[{listing_id:LISTING,lease_token:LEASE,attempts:3}],error:null,
     };
     if(name==="marketplace_alert_pause_outbox_v1"){
       assert.equal(args.p_listing_id,LISTING);
       assert.equal(args.p_lease_token,LEASE);
       return {data:pauseOk,error:pauseError?Error("PRIVATE_SQL"):null};
     }
     throw Error("Unsafe fallback to "+name);
   },
 };
 const exports={};
 runInNewContext(compiled,{exports,require(id){
  assert.equal(id,"@/lib/supabase/admin");
  return {createAdminClient:()=>admin};
 },process:{env:{
   CRON_SECRET:"synthetic-secret",
   WETUDY_ALERT_OUTBOX_ENABLED:"true",
   WETUDY_ALERT_INTENT_DELIVERY_ENABLED:"true",
   WETUDY_SAVED_SEARCH_ALERTS_ENABLED:"true",
 }},Response,Request,AbortSignal,
 fetch:async(url,options)=>{
   events.push("FETCH");
   assert.equal(url,"https://www.wetudy.com/api/marketplace/listings/match-saved-searches");
   assert.equal(options.headers.authorization,"Bearer synthetic-secret");
   assert.equal(options.redirect,"manual");
   return Response.json({
     ok:true,complete:false,paused:true,reason:"alerts_disabled",
   },{status:202});
 },console:{error:()=>{}},
 },{timeout:2000});
 return {events,run:async()=>{
   const response=await exports.GET(new Request("https://wetudy.invalid/api/cron/marketplace-alert-outbox",{
     headers:{authorization:"Bearer synthetic-secret"},
   }));
   return {status:response.status,body:await response.json(),
     cache:response.headers.get("cache-control")};
 }};
}
test("paused matcher releases same lease without wiping previous failures",async()=>{
 const f=run(),r=await f.run();
 assert.equal(r.status,202);
 assert.equal(r.cache,"private, no-store");
 assert.deepEqual(JSON.parse(JSON.stringify(r.body)),{
   ok:true,complete:false,claimed:1,outcome:"alerts_paused",
 });
 assert.equal(f.events.filter(x=>x==="RPC:marketplace_alert_pause_outbox_v1").length,1);
 assert.ok(f.events.includes("FETCH"));
 assert.equal(f.events.some(x=>x==="RPC:marketplace_alert_requeue_progress_v1"),false);
 assert.equal(f.events.some(x=>x==="RPC:marketplace_alert_settle_outbox_v1"),false);
});
test("stale or failed pause never reports delivery or retry success",async()=>{
 for(const options of [{pauseOk:false},{pauseError:true}]){
  const f=run(options),r=await f.run();
  assert.ok([409,500].includes(r.status));
  assert.equal(f.events.some(x=>x==="RPC:marketplace_alert_requeue_progress_v1"),false);
  assert.equal(f.events.some(x=>x==="RPC:marketplace_alert_settle_outbox_v1"),false);
  assert.doesNotMatch(JSON.stringify(r.body),/PRIVATE_SQL/);
 }
});
test("pause SQL is review-only and service-only with token and expiry fencing",()=>{
 assert.match(sql,/REVIEW ONLY \/ NEVER AUTODEPLOY/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/attempts=greatest\(q\.attempts - 1, 0\)/);
 assert.match(sql,/q\.lease_token=p_lease_token/);
 assert.match(sql,/q\.lease_until > now\(\)/);
 assert.match(sql,/q\.expires_at > now\(\)/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/TO service_role/);
 assert.match(matcher,/paused:true,reason:"alerts_disabled"/);
 assert.doesNotMatch(sql,/TRUNCATE|DROP TABLE|ALTER DEFAULT PRIVILEGES/i);
});
