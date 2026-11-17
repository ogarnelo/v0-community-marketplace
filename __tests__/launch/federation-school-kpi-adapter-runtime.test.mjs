import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const ts=createRequire(import.meta.url)("typescript");
const source=readFileSync("lib/reports/federation-school-kpi-adapter.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={};
vm.runInNewContext(js,{exports:mod,Date,Set,Number,Error},{timeout:1500});
const school="33333333-3333-4333-8333-333333333333";
const scope={schoolIds:[school],start:"2026-09-01T00:00:00Z",end:"2026-11-01T00:00:00Z"};
const makeReport=(opts={})=>({
 school:{id:school,name:"Colegio sintético",is_active:true,city:"CIUDAD PRIVADA"},
 periodKey:"2026-09",periodLabel:"Periodo",reusedItems:4,donatedItems:2,
 soldItems:2,circularValue:65,estimatedAvoidedCo2:8.4,activeListings:3,
 listingViews:40,members:12,administrators:1,openReports:2,
 confidentialEmail:"PRIVATE_EMAIL",messages:[{body:"PRIVATE_MESSAGE"}],
 ...opts,
});
function build(report=makeReport(),active=true){
 const calls=[];
 const load=mod.createFederationSchoolKpiLoader({
  loadSchoolImpact:async arg=>{calls.push("LOAD:"+arg.schoolId);return report},
  verifySchoolStillActive:async id=>{calls.push("VERIFY:"+id);return active},
 });
 return {calls,load};
}
test("trusted existing school report projects only federated KPI allowlist",async()=>{
 const h=build();const rows=await h.load(scope);
 assert.equal(rows.length,1);
 assert.equal(rows[0].schoolId,school);
 assert.equal(rows[0].circularValue,65);
 assert.equal(rows[0].members,12);
 assert.deepEqual(h.calls,["LOAD:"+school,"VERIFY:"+school]);
 assert.doesNotMatch(JSON.stringify(rows),/PRIVATE_EMAIL|PRIVATE_MESSAGE|CIUDAD PRIVADA|openReports|administrators/);
});
test("missing, wrong and inactive school report fails before projecting",async()=>{
 for(const row of [null,makeReport({school:{id:"44444444-4444-4444-8444-444444444444",name:"Otro",is_active:true}}),
  makeReport({school:{id:school,name:"Centro",is_active:null}})]){
  const h=build(row);
  await assert.rejects(h.load(scope),/FEDERATION_SCHOOL_INACTIVE_OR_MISMATCH/);
  assert.deepEqual(h.calls,["LOAD:"+school]);
 }
});
test("deactivation after impact report loading blocks KPI output",async()=>{
 const h=build(makeReport(),false);
 await assert.rejects(h.load(scope),/FEDERATION_SCHOOL_INACTIVE_OR_MISMATCH/);
 assert.deepEqual(h.calls,["LOAD:"+school,"VERIFY:"+school]);
});
test("invalid period, duplicate or out-of-bounds scope never calls privileged loader",async()=>{
 for(const s of [{...scope,schoolIds:[]},
   {...scope,schoolIds:[school,school]},
   {...scope,schoolIds:["invalid-school"]},
   {...scope,start:"not-a-date"},
   {...scope,end:"2026-01-01T00:00:00Z"}]){
   const h=build();
   await assert.rejects(h.load(s),/INVALID_FEDERATION_KPI_/);
   assert.equal(h.calls.length,0);
 }
});
test("bounded fan-out denies 26 schools before any backend reads",async()=>{
 const ids=Array.from({length:26},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`);
 const h=build();
 await assert.rejects(h.load({...scope,schoolIds:ids}),/INVALID_FEDERATION_KPI_SCOPE/);
 assert.equal(h.calls.length,0);
});
test("only exact report loader and fresh active verifier are accepted",()=>{
 assert.throws(()=>mod.createFederationSchoolKpiLoader({loadSchoolImpact:async()=>makeReport()}),
   /FEDERATION_KPI_DEPENDENCIES_UNAVAILABLE/);
});
