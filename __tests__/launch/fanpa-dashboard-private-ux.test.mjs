import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("lib/fanpa/federation-dashboard-contract.ts","utf8");
const page = readFileSync("app/fanpa/informes/page.tsx","utf8");
const view = readFileSync("components/fanpa/federation-reporting-dashboard.tsx","utf8");
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,{module:mod,exports:mod.exports,Set,Number});
const { metricText,validSchoolOptions,validReport,schoolMetricLabels }=mod.exports;
const F="ffffffff-ffff-4fff-8fff-ffffffffffff";
const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const options=[{id:A,name:"Colegio A"},{id:B,name:"Colegio B"}];
function sample(override={}) {
 return {totalSchools:2,uniqueUsers:null,students:null,activeListings:null,
  totalListings:null,openDemands:null,confirmedExchanges:null,
  schools:[
   {schoolId:A,name:"Colegio A",users:8,students:10,activeListings:3,
    totalListings:5,openDemands:2,confirmedExchanges:1},
   {schoolId:B,name:"Colegio B",users:null,students:null,activeListings:null,
    totalListings:null,openDemands:null,confirmedExchanges:null},
  ],...override};
}
test("dashboard never renders tiny-school counts as zero or arbitrary strings",()=>{
 for(const hidden of [null,undefined,-1,NaN,Infinity,2.5,"4",{}]){
  assert.equal(metricText(hidden),"Oculto");
 }
 assert.equal(metricText(0),"0");
 assert.equal(metricText(12),"12");
});
test("only complete and unique authorized school scopes are accepted",()=>{
 assert.equal(validSchoolOptions(options),true);
 assert.equal(validSchoolOptions([options[0],options[0]]),false);
 assert.equal(validSchoolOptions([{id:F,name:"X"},{id:"bad",name:"Y"}]),false);
 assert.equal(validSchoolOptions(Array(101).fill({id:A,name:"X"})),false);
});
test("report payload is restricted to authorized IDs and well-formed numbers",()=>{
 assert.equal(validReport(sample(),[A,B]),true);
 assert.equal(validReport(sample(),[A]),false);
 assert.equal(validReport(sample({students:-1}),[A,B]),false);
 assert.equal(validReport(sample({totalSchools:3}),[A,B]),false);
 assert.equal(validReport(sample({schools:[sample().schools[0],sample().schools[0]]}),[A,B]),false);
 assert.equal(validReport(sample({schools:[sample().schools[0],
  {...sample().schools[1],users:"private"}]}),[A,B]),false);
});
test("one-school mode cannot accept multi-school response",()=>{
 const school=sample().schools[0];
 assert.equal(validReport({...sample(),totalSchools:1,schools:[school]},[A]),true);
 assert.equal(validReport({...sample(),totalSchools:2},[A]),false);
});
test("school columns do not incorrectly include federation-only uniqueUsers",()=>{
 assert.ok(schoolMetricLabels.length>0);
 assert.equal(schoolMetricLabels.some(m=>m.key==="uniqueUsers"),false);
});
test("dashboard is noindex and fails closed before loading any client code",()=>{
 assert.match(page,/WETUDY_FANPA_REPORTING_ENABLED !== "true"/);
 assert.match(page,/WETUDY_FANPA_KPI_ENABLED !== "true"/);
 assert.match(page,/robots: \{ index: false, follow: false \}/);
 assert.match(page,/notFound\(\)/);
 assert.match(page,/supabase\.auth\.getUser\(\)/);
 assert.match(page,/email_confirmed_at/);
});
test("UI requests only gated APIs, rechecks scope and clears stale state",()=>{
 assert.match(view,/fetch\("\/api\/fanpa\/scope\?"/);
 assert.match(view,/fetch\("\/api\/fanpa\/kpis\?"/);
 assert.match(view,/new AbortController\(\)/);
 assert.match(view,/setReport\(null\)/);
 assert.match(view,/validReport\(body, expected\)/);
 assert.match(view,/validSchoolOptions\(body\.schools\)/);
 assert.match(view,/role="alert"/);
 assert.doesNotMatch(view,/service_role|createAdminClient|\.from\("profiles"\)/);
});
