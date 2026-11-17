import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const ts=createRequire(import.meta.url)("typescript");
const src=readFileSync("lib/reports/federation-dashboard-view-model.ts","utf8");
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={};
vm.runInNewContext(js,{exports:mod,Date,Set,Number,Error},{timeout:1500});
const id="11111111-1111-4111-8111-111111111111";
const values={reusedItems:3,donatedItems:1,soldItems:2,circularValue:26.5,estimatedAvoidedCo2:6.3,
  activeListings:2,listingViews:18,privateEmail:"someone@example.invalid"};
const makeReport=(over={})=>({
 period:"365d",start:"2025-11-17T12:00:00Z",end:"2026-11-17T12:00:00Z",
 schools:[{schoolId:id,schoolName:"Colegio A",metrics:values,suppressed:false,details:"PRIVATE_MARKER"}],
 total:values,totalSuppressed:false,...over
});
test("view model projects only seven allowed KPI fields and never personal data",()=>{
 const model=mod.buildFederationDashboardModel({organization:" FAMPA Norte ",report:makeReport()});
 assert.equal(model.organization,"FAMPA Norte");
 assert.equal(model.periodLabel,"Últimos 365 días");
 assert.equal(model.schools.length,1);
 assert.equal(model.schools[0].metrics.length,7);
 assert.equal(model.total[3].key,"circularValue");
 assert.doesNotMatch(JSON.stringify(model),/PRIVATE_MARKER|privateEmail|someone@example/);
});
test("small-school suppression returns null rather than zero or leaked amounts",()=>{
 const report=makeReport({schools:[{schoolId:id,schoolName:"Colegio A",
  suppressed:true,metrics:null}],total:null,totalSuppressed:true});
 const model=mod.buildFederationDashboardModel({organization:"CEAPA",report});
 assert.equal(model.schools[0].metrics,null);
 assert.equal(model.total,null);
 assert.equal(model.totalSuppressed,true);
 assert.doesNotMatch(JSON.stringify(model),/circularValue|reusedItems/);
});
test("no fake zero for missing total even when upstream flag disagrees",()=>{
 const model=mod.buildFederationDashboardModel({organization:"CEAPA",
  report:makeReport({total:null,totalSuppressed:false})});
 assert.equal(model.total,null);assert.equal(model.totalSuppressed,true);
});
test("reject client-like duplicate or invalid school rows",()=>{
 const first=makeReport().schools[0];
 for(const report of [
   makeReport({schools:[first,{...first}]}),
   makeReport({schools:[{...first,schoolId:"foreign"}]}),
   makeReport({schools:[{...first,metrics:null,suppressed:false}]}),
   makeReport({schools:[]}),
   makeReport({period:"custom"}),
 ]){
  assert.throws(()=>mod.buildFederationDashboardModel({organization:"FAMPA",report}),
    /INVALID_FEDERATION_DISPLAY_STATE/);
 }
});
test("infinite, negative and unsafe integer values are never formatted or emitted",()=>{
 for(const invalid of [{...values,circularValue:Infinity},
   {...values,reusedItems:2.5},{...values,soldItems:-1}]){
  assert.throws(()=>mod.buildFederationDashboardModel({organization:"FAMPA",
   report:makeReport({schools:[{schoolId:id,schoolName:"School",suppressed:false,metrics:invalid}]})}),
   /INVALID_FEDERATION_DISPLAY_METRIC/);
 }
});
test("organization and period must be present and server-bounded",()=>{
 assert.throws(()=>mod.buildFederationDashboardModel({organization:"",report:makeReport()}),/INVALID_FEDERATION_DISPLAY_STATE/);
 assert.throws(()=>mod.buildFederationDashboardModel({organization:"CEAPA",
 report:makeReport({end:"malformed"})}),/INVALID_FEDERATION_DISPLAY_STATE/);
});
