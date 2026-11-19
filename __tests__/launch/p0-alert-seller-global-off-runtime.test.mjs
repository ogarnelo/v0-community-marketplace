import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";

const matcher=readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts","utf8");
const ID="11111111-1111-4111-8111-111111111111";
const USER="22222222-2222-4222-8222-222222222222";
const SEARCH="33333333-3333-4333-8333-333333333333";
const compiled=ts.transpileModule(matcher,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true},
  fileName:"alert-matcher.ts",reportDiagnostics:true,
});
assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);

function fixture(globalFlag){
 const events=[],errors=[];
 const user={id:USER};
 const listing={id:ID,seller_id:USER,user_id:USER,status:"available",is_demo:false,
   created_at:"2026-11-19T00:00:00Z",title:"Synthetic book",school_id:null,
   directory_school_code:null,postal_code:null};
 const saved={id:SEARCH,user_id:"44444444-4444-4444-8444-444444444444",
   demand_request_id:null,only_my_community:false,radius_km:null,
   directory_school_code:null,notifications_enabled:true};
 const admin={
   from(table){
     events.push("DB:"+table);
     if(table==="listings")return {select(){return this},eq(){return this},
       async maybeSingle(){return {data:listing,error:null}}};
     if(table==="saved_searches")return {select(){return this},eq(){return this},
       neq(){return this},order(){return this},limit(){return this},
       then(ok,bad){return Promise.resolve({data:[saved],error:null}).then(ok,bad)}};
     if(table==="saved_search_matches")return {async upsert(rows){
       events.push("PERSIST_MATCHES");assert.equal(rows.length,1);
       assert.equal(rows[0].saved_search_id,SEARCH);
       return {error:null};
     }};
     throw Error("Unexpected privileged query "+table);
   },
 };
 const failProvider=()=>{events.push("FORBIDDEN_SIDE_EFFECT");throw Error("SIDE_EFFECT_LEAK");};
 const modules={
   "next/server":{NextResponse:{json:(body,opts={})=>Response.json(body,{
     status:opts.status??200,headers:opts.headers})}},
   "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({
     data:{user},error:null})}})},
   "@/lib/supabase/admin":{createAdminClient:()=>admin},
   "@/lib/marketplace/saved-search-matching":{savedSearchMatchesListing:()=>true},
   "@/lib/marketplace/active-family-alert-scopes":{loadCurrentFamilyAlertScopes:failProvider},
   "@/lib/marketplace/postal-distance":{approximateDistanceKm:()=>0},
   "@/lib/marketplace/saved-search-batches.mjs":{
     loadAllSortedPages:async(loader)=>{const result=await loader(null,50);return result},
     batchAlertItems:(items)=>[items]},
   "@/lib/marketplace/alert-delivery-progress.mjs":{
     selectDeliveryPage:failProvider,summarizeDeliveryProgress:failProvider},
   "@/lib/marketplace/alert-pending-page.mjs":{loadPendingDeliveryRows:failProvider},
   "@/lib/marketplace/alert-discovery-page.mjs":{
     summarizeDiscoveryPage:failProvider,WORKER_DISCOVERY_PAGE_SIZE:50},
   "@/lib/marketplace/alert-live-radius.mjs":{
     hasRadiusConstraint:failProvider,partitionLiveRadius:failProvider},
   "@/lib/marketplace/alert-live-school.mjs":{
     codesForLiveSchoolPage:failProvider,partitionLiveSchool:failProvider},
   "@/lib/emails/saved-search-match-email":{sendSavedSearchMatchEmail:failProvider},
   "@/lib/notifications":{createNotificationOnce:failProvider},
   "@/lib/emails/delivery-idempotency":{sendTransactionalEmailOnce:failProvider},
   "@/lib/emails/marketplace-alert-intent-gated":{sendGatedMarketplaceAlertWithIntent:failProvider},
   "@/lib/marketplace/alert-intent-feature-gate.mjs":{shouldUseAlertIntentDelivery:failProvider},
   "@/lib/demand/need-attribution":{recordNeedResult:failProvider},
 };
 const exports={};
 runInNewContext(compiled.outputText,{
   exports,require:name=>{assert.ok(name in modules,"Unmocked import "+name);return modules[name]},
   process:{env:{WETUDY_SAVED_SEARCH_ALERTS_ENABLED:globalFlag}},
   Request,Response,Date,Promise,Map,Set,console:{error:(...args)=>errors.push(args)},
 },{timeout:2000});
 return {events,errors,run:async()=>{
   const response=await exports.POST(new Request("https://wetudy.invalid/api/marketplace/listings/match-saved-searches",{
     method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({listingId:ID}),
   }));
   return {status:response.status,body:await response.json(),cache:response.headers.get("cache-control")};
 }};
}
test("seller OFF still persists discovered matches but never contacts channels",async()=>{
 for(const flag of [undefined,null,"","false","TRUE","true ","1"]){
  const f=fixture(flag),r=await f.run();
  assert.equal(r.status,200);
  assert.equal(r.cache,"private, no-store");
  assert.deepEqual(JSON.parse(JSON.stringify(r.body)),{
    ok:true,complete:true,alertsDisabled:true,matched:1,notified:0,emailed:0,supplyGenerated:false,
  });
  assert.ok(f.events.includes("PERSIST_MATCHES"),"save matches even when not emailing");
  assert.equal(f.events.includes("FORBIDDEN_SIDE_EFFECT"),false);
  assert.deepEqual(f.errors,[]);
 }
});
test("seller global OFF gate must occur after attribution but before both channels",()=>{
 const a=matcher.indexOf("if (!isOutboxWorker && process.env.WETUDY_SAVED_SEARCH_ALERTS_ENABLED");
 const m=matcher.indexOf("matches = contentCandidates");
 const n=matcher.indexOf("const pendingNotifications");
 const e=matcher.indexOf("const pendingMatches");
 assert.ok(m>=0 && a>m && a<n && a<e);
 assert.match(matcher,/notified: 0, emailed: 0, supplyGenerated/);
});
