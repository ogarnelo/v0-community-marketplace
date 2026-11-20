import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(path, dep = {}) {
 const source = readFileSync(path, "utf8");
 const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
 }).outputText;
 const mod={exports:{}};
 vm.runInNewContext(js, {
  exports:mod.exports,module:mod,Set,Map,
  require(name) { assert.ok(name in dep, "Unexpected import "+name);return dep[name]; }
 });
 return mod.exports;
}
const members=load("lib/reports/school-membership.ts");
const kpis=load("lib/fanpa/federation-kpis.ts",{
 "@/lib/reports/school-membership":members
});
const {computeScopedFederationReport:report}=load("lib/fanpa/federation-report-view.ts",{
 "@/lib/fanpa/federation-kpis":kpis
});

const data={
 schools:[{id:"A",name:"Cole A"},{id:"B",name:"Cole B"},{id:"C",name:"Cole C"}],
 profiles:[{id:"family",school_id:"A"},{id:"foreign",school_id:"C"}],
 students:[
  {owner_user_id:"family",school_id:"A"},
  {owner_user_id:"family",school_id:"B"},
  {owner_user_id:"foreign",school_id:"C"},
 ],
 admins:[
  ...Array.from({length:5},(_,i)=>({user_id:"admin-a-"+i,school_id:"A"})),
  {user_id:"admin-c",school_id:"C"},
 ],
 listings:[
  {id:"a",school_id:"A",status:"available"},
  {id:"b",school_id:"B",status:"reserved"},
  {id:"secret",school_id:"C",status:"available"},
 ],
 demands:[
  {id:"a",school_id:"A",status:"open"},
  {id:"b",school_id:"B",status:"open"},
  {id:"private",school_id:"C",status:"open"},
 ],
 agreements:[
  {id:"a",school_id:"A",status:"confirmed"},
  {id:"b",school_id:"B",status:"confirmed"},
  {id:"private",school_id:"C",status:"confirmed"},
 ],
};

test("without verified represented schools, federation report refuses disclosure",()=>{
 assert.equal(report(data,[]),null);
 assert.equal(report(data,["C"],"A"),null);
 assert.equal(report(data,["A"],"B"),null);
 assert.equal(report({...data,schools:[]},["A"]),null);
});

test("scopes both totals and rows; no out-of-federation school leaks",()=>{
 const result=report(data,["A","B","A"]);
 assert.equal(result.totalSchools,2);
 assert.deepEqual(Array.from(result.schools.map(x=>x.id)),["A","B"]);
 assert.equal(result.uniqueUsers,6);
 assert.equal(result.activeListings,2);
 assert.equal(result.totalListings,2);
 assert.equal(result.openDemands,null,"tiny B cohort suppresses all-school sensitive totals");
 assert.equal(result.confirmedExchanges,null);
 assert.equal(result.schools[0].openDemands,1);
 assert.equal(result.schools[1].openDemands,null);
 const serialized=JSON.stringify(result);
 for(const forbidden of ["foreign","secret","private","admin-a","family","Cole C"]) {
  assert.equal(serialized.includes(forbidden),false,forbidden+" must not leave the server");
 }
});

test("verified per-school filter cannot disclose another school or bypass small cohorts",()=>{
 const a=report(data,["A","B"],"A");
 assert.equal(a.totalSchools,1);
 assert.equal(a.uniqueUsers,6);
 assert.equal(a.openDemands,1);
 assert.equal(a.confirmedExchanges,1);
 const b=report(data,["A","B"],"B");
 assert.equal(b.totalSchools,1);
 assert.equal(b.uniqueUsers,1);
 assert.equal(b.openDemands,null);
 assert.equal(b.confirmedExchanges,null);
 assert.equal(b.schools[0].openDemands,null);
});

test("legacy profile at A is not counted if an active student is only at B",()=>{
 const minimal={
  schools:[{id:"A",name:"A"}],
  profiles:[{id:"legacy",school_id:"A"}],
  students:[{owner_user_id:"legacy",school_id:"B"}],
  admins:[], listings:[],demands:[],agreements:[]
 };
 const result=report(minimal,["A"]);
 assert.equal(result.uniqueUsers,0);
});

test("no caller can route a selectedSchoolId into a broader disclosure",()=>{
 const result=report(data,["A"],"C");
 assert.equal(result,null);
 const source=readFileSync("lib/fanpa/federation-report-view.ts","utf8");
 assert.doesNotMatch(source,/createAdminClient|createClient|\.from\("|getUser|service_role|fetch\(/);
 assert.match(source,/representedSchoolIds/);
 assert.match(source,/MIN_PRIVATE_COHORT = 5/);
});
