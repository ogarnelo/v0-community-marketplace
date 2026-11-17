import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const ts=createRequire(import.meta.url)("typescript");
function moduleAt(path,requires={}){
 const ex={};
 const js=ts.transpileModule(readFileSync(path,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports:ex,require:name=>{assert.ok(name in requires,name);return requires[name]},
 Date,Map,Set,Number,Error},{timeout:2000});
 return ex;
}
const prefix="lib/reports/";
const scope=moduleAt(prefix+"federation-reporting-scope.ts");
const hierarchy=moduleAt(prefix+"federation-reporting-hierarchy.ts",{"./federation-reporting-scope":scope});
const filters=moduleAt(prefix+"federation-report-filters.ts",{"./federation-reporting-scope":scope});
const kpis=moduleAt(prefix+"federation-kpi-projection.ts");
const gateway=moduleAt(prefix+"federation-report-gateway.ts",{
 "./federation-reporting-hierarchy":hierarchy,
 "./federation-report-filters":filters,
 "./federation-kpi-projection":kpis
});
const user="11111111-1111-4111-8111-111111111111",federation="22222222-2222-4222-8222-222222222222";
const school1="33333333-3333-4333-8333-333333333333",school2="44444444-4444-4444-8444-444444444444";
const now=new Date("2026-11-17T12:00:00.000Z");
const representation=id=>({federationId:federation,schoolId:id,state:"active",startsAt:"2026-01-01T00:00:00Z",endsAt:null});
const authority=()=>({userId:user,rootFederationId:federation,now,
 memberships:[{userId:user,federationId:federation,role:"report_viewer",state:"active"}],
 links:[],representations:[representation(school1),representation(school2)]});
const metric=(id,members=20)=>({schoolId:id,schoolName:"Centro Sintético",members,
 reusedItems:3,donatedItems:1,soldItems:2,circularValue:10,estimatedAvoidedCo2:6.3,
 activeListings:2,listingViews:12,email:"SECRET_EMAIL"});
const run=(options={})=>{
 const calls=[];
 const rows=options.rows??[metric(school1),metric(school2)];
 const loadAuthorizedSchools=async params=>{calls.push(params);return rows};
 const query=gateway.createFederationReport({
  authority:options.authority??authority(),requestedPeriod:options.period??"90d",
  requestedSchoolId:options.schoolId,
  loadAuthorizedSchools
 });
 return {calls,query};
};
test("selected school fetches FULL trusted scope, not just client filter",async()=>{
 const h=run({schoolId:school1}),report=await h.query;
 assert.equal(h.calls.length,1);
 assert.deepEqual(Array.from(h.calls[0].schoolIds),[school1,school2]);
 assert.deepEqual(Array.from(report.schools,x=>x.schoolId),[school1]);
 assert.equal(report.total.reusedItems,6);
 assert.doesNotMatch(JSON.stringify(report),/SECRET_EMAIL|members/);
});
test("unrepresented school blocks loader invocation entirely",async()=>{
 const h=run({schoolId:"55555555-5555-4555-8555-555555555555"});
 await assert.rejects(h.query,/FEDERATION_REPORT_SCOPE_DENIED/);
 assert.equal(h.calls.length,0);
});
test("revoked membership prevents privileged metric loader calls",async()=>{
 const a=authority();a.memberships[0].state="revoked";
 const h=run({authority:a});
 await assert.rejects(h.query,/FEDERATION_REPORT_SCOPE_DENIED/);
 assert.equal(h.calls.length,0);
});
test("missing school metrics must fail, never treat missing school as zero",async()=>{
 const h=run({rows:[metric(school1)]});
 await assert.rejects(h.query,/INCOMPLETE_REPORTING_METRICS/);
});
test("small school suppresses all-scope total EVEN if filter selects other school",async()=>{
 const h=run({schoolId:school1,rows:[metric(school1,20),metric(school2,3)]});
 const report=await h.query;
 assert.equal(report.total,null);
 assert.equal(report.totalSuppressed,true);
 assert.equal(report.schools[0].suppressed,false);
});
test("unrepresented extra row from loader errors, never silently ignored",async()=>{
 const h=run({rows:[metric(school1),metric(school2),metric("55555555-5555-4555-8555-555555555555")]});
 await assert.rejects(h.query,/FEDERATION_REPORT_SCOPE_DENIED/);
});
