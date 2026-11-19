import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
const ts=createRequire(import.meta.url)("typescript");
const sql=readFileSync("docs/pilot/sql/p0_school_impact_shared_claim_review_only_20261119.sql","utf8");
const source=readFileSync("lib/reports/p0-school-impact-shared-claim-rpc.ts","utf8");
const SCHOOL="11111111-1111-4111-8111-111111111111";
const USER="22222222-2222-4222-8222-222222222222";
const SUB="33333333-3333-4333-8333-333333333333";
const CLAIM="44444444-4444-4444-8444-444444444444";

test("review-only SQL has one exclusive claim per school recipient and period",()=>{
 assert.match(sql,/REVIEW ONLY \/ NEVER AUTODEPLOY/);
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;/);
 assert.match(sql,/UNIQUE \(school_id,user_id,period_key\)/);
 assert.match(sql,/ON CONFLICT \(school_id,user_id,period_key\) DO NOTHING/);
 assert.match(sql,/source IN \('manual','cron'\)/);
 assert.match(sql,/source <> 'cron' OR subscription_id IS NOT NULL/);
 assert.match(sql,/p_source='cron'/);
 assert.match(sql,/p_subscription_id IS NULL/);
 assert.match(sql,/p_source='manual'|ELSE/);
 assert.match(sql,/school_impact_report_deliveries d/);
 assert.match(sql,/last_sent_month = p_period_key/);
 assert.match(sql,/count\(\*\) FROM public.user_roles/);
 assert.doesNotMatch(sql,/DELETE FROM public\.p0_school_impact_shared_dispatch_claims_candidate|TRUNCATE|ALTER DEFAULT PRIVILEGES/i);
});
test("claim is service-only, RLS protected, invoker and does not expire",()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/SECURITY INVOKER/g);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.p0_school_impact_shared_claim_candidate[\s\S]*TO service_role/);
 assert.doesNotMatch(sql,/lease_until|expires_at|automatic_retry|DROP TABLE/i);
 assert.match(sql,/p0_school_impact_shared_ack_candidate/);
});
function fixture(mode="ok"){
 const e=[],exports={};
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports,Promise,Error,Number,String,RegExp}, {timeout:1500});
 return {e,api:exports,admin:{rpc:async (name,args)=>{
   e.push({name,args});
   if(mode==="throw") throw Error("PROVIDER_PRIVATE");
   if(mode==="error")return {data:null,error:Error("PRIVATE_DB")};
   if(mode==="none")return {data:null,error:null};
   return {data:name.endsWith("_ack_candidate")?true:CLAIM,error:null};
 }}};
}
const base={schoolId:SCHOOL,userId:USER,periodKey:"2026-10",email:"school@example.invalid"};
test("manual claim never requires subscription, day, or marker",async()=>{
 const f=fixture();
 assert.equal(await f.api.acquireSharedSchoolReportClaim({...base,source:"manual",admin:f.admin}),CLAIM);
 assert.equal(f.e.length,1);
 assert.equal(f.e[0].name,"p0_school_impact_shared_claim_candidate");
 assert.equal(f.e[0].args.p_source,"manual");
 for(const field of ["p_subscription_id","p_day","p_expected_last_sent"])
   assert.equal(f.e[0].args[field],null);
});
test("cron shares the same RPC but asserts validated subscription",async()=>{
 const f=fixture();
 assert.equal(await f.api.acquireSharedSchoolReportClaim({...base,source:"cron",
   admin:f.admin,subscriptionId:SUB,day:19,expectedLastSent:null}),CLAIM);
 assert.equal(f.e[0].args.p_source,"cron");
 assert.equal(f.e[0].args.p_subscription_id,SUB);
 assert.equal(f.e[0].args.p_day,19);
});
test("unclaimed or unknown outcomes cannot authorize provider send",async()=>{
 for(const mode of ["none","throw","error"]){
  const f=fixture(mode);
  const invoke=()=>f.api.acquireSharedSchoolReportClaim({...base,source:"manual",admin:f.admin});
  if(mode==="none")assert.equal(await invoke(),null);
  else await assert.rejects(invoke(),/reconcil|confirm/i);
 }
});
test("acknowledgement enforces provider receipt and rejects ambiguous result",async()=>{
 const f=fixture();
 await f.api.acknowledgeSharedSchoolReportClaim({admin:f.admin,claimId:CLAIM,providerMessageId:"provider-test"});
 assert.equal(f.e[0].name,"p0_school_impact_shared_ack_candidate");
 const g=fixture();
 await assert.rejects(()=>g.api.acknowledgeSharedSchoolReportClaim({
   admin:g.admin,claimId:CLAIM,providerMessageId:""
 }),/receipt/);
 assert.equal(g.e.length,0);
});
