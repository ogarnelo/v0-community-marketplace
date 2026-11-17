import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
function load(path,deps={}){
 const exports={};
 const js=ts.transpileModule(readFileSync(path,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports,require:(name)=>{assert.ok(name in deps,name);return deps[name]},
  Date,Map,Set,Number,Object,Error},{timeout:2500});
 return exports;
}
const prefix="lib/reports/";
const scope=load(prefix+"federation-reporting-scope.ts");
const hierarchy=load(prefix+"federation-reporting-hierarchy.ts",{"./federation-reporting-scope":scope});
const filters=load(prefix+"federation-report-filters.ts",{"./federation-reporting-scope":scope});
const kpi=load(prefix+"federation-kpi-projection.ts");
const gateway=load(prefix+"federation-report-gateway.ts",{
 "./federation-reporting-hierarchy":hierarchy,
 "./federation-report-filters":filters,
 "./federation-kpi-projection":kpi,
});
const snapshotAdapter=load(prefix+"federation-authority-snapshot.ts");
const schoolAdapter=load(prefix+"federation-school-kpi-adapter.ts");
const service=load(prefix+"federation-report-service.ts",{
 "server-only":{},
 "./federation-authority-snapshot":snapshotAdapter,
 "./federation-report-gateway":gateway,
 "./federation-school-kpi-adapter":schoolAdapter,
});
const id=n=>String(n).padStart(8,"0")+"-1111-4111-8111-111111111111";
const user=id(1),fampa=id(2),ampa1=id(3),ampa2=id(4),school1=id(5),school2=id(6),verifier=id(7);
const now=new Date("2026-11-17T12:00:00.000Z");
const relation={status:"verified",verified_by:verifier,valid_from:"2026-01-01T00:00:00Z",valid_until:null};
function makeSnapshot(){
 return {
  complete:{organizations:true,associations:true,schools:true,associationSchools:true,
   organizationAssociations:true,hierarchy:true,memberships:true},
  organizations:[{id:fampa,status:"verified"}],
  associations:[{id:ampa1,status:"verified"},{id:ampa2,status:"verified"}],
  schools:[{id:school1,is_active:true},{id:school2,is_active:true}],
  associationSchools:[{association_id:ampa1,school_id:school1,...relation},
   {association_id:ampa2,school_id:school2,...relation}],
  organizationAssociations:[{organization_id:fampa,association_id:ampa1,...relation},
   {organization_id:fampa,association_id:ampa2,...relation}],
  hierarchy:[],
  memberships:[{organization_id:fampa,user_id:user,role:"report_viewer",status:"active",verified_by:verifier}],
 };
}
function reportFor(id,memberCount=12){
 return {school:{id,name:"Colegio sintético",is_active:true},reusedItems:3,
  donatedItems:1,soldItems:2,circularValue:24,estimatedAvoidedCo2:6.3,
  activeListings:2,listingViews:10,members:memberCount,administrators:99,
  openReports:15,secret:"PRIVATE_DETAILS"};
}
const run=(options={})=>{
 const calls=[];
 let snapshots=0;
 const report=service.loadVerifiedFederationReport({
  authenticatedUserId:user,federationId:fampa,
  period:"90d",schoolId:options.schoolId,
  dependencies:{
   serverNow:()=>now,
   loadCompleteAuthoritySnapshot:async()=>{
     calls.push("SNAPSHOT");snapshots++;
     return snapshots===1?(options.first??makeSnapshot()):(options.second??makeSnapshot());
   },
   loadSchoolImpact:async({schoolId})=>{
     calls.push("REPORT:"+schoolId);
     return options.report?.(schoolId)??reportFor(schoolId);
   },
   verifySchoolStillActive:async schoolId=>{
     calls.push("ACTIVE:"+schoolId);
     return true;
   },
  },
 });
 return {calls,report};
};
test("FAMPA scope -> two AMPA schools -> KPI allowlist -> FRESH verification",async()=>{
 const x=run(),report=await x.report;
 assert.equal(x.calls.filter(c=>c==="SNAPSHOT").length,2);
 assert.equal(x.calls.filter(c=>c.startsWith("REPORT:")).length,2);
 assert.equal(x.calls.filter(c=>c.startsWith("ACTIVE:")).length,2);
 assert.equal(x.calls.at(-1),"SNAPSHOT");
 assert.equal(report.total.reusedItems,6);
 assert.equal(report.schools.length,2);
 assert.doesNotMatch(JSON.stringify(report),/PRIVATE_DETAILS|administrators|openReports|members/);
});
test("filtered school still loads both authorized schools before responding",async()=>{
 const x=run({schoolId:school1}),report=await x.report;
 assert.equal(report.schools.length,1);
 assert.equal(report.schools[0].schoolId,school1);
 assert.equal(x.calls.filter(c=>c.startsWith("REPORT:")).length,2);
});
test("representative revoked DURING aggregation denies result entirely",async()=>{
 const second=makeSnapshot();
 second.memberships[0].status="revoked";
 const x=run({second});
 await assert.rejects(x.report,/FEDERATION_REPORT_SCOPE_CHANGED/);
 assert.equal(x.calls.filter(c=>c==="SNAPSHOT").length,2);
});
test("withdrawn legal AMPA link during aggregation denies result entirely",async()=>{
 const second=makeSnapshot();
 second.organizationAssociations[1].status="revoked";
 const x=run({second});
 await assert.rejects(x.report,/FEDERATION_REPORT_SCOPE_CHANGED/);
});
test("incomplete snapshot rejects before any privileged school report loading",async()=>{
 const first=makeSnapshot();first.complete.associationSchools=false;
 const x=run({first});
 await assert.rejects(x.report,/INCOMPLETE_FEDERATION_AUTHORITY_SNAPSHOT/);
 assert.equal(x.calls.filter(c=>c.startsWith("REPORT:")).length,0);
});
test("deactivated school on initial snapshot cannot produce metrics",async()=>{
 const first=makeSnapshot();first.schools[1].is_active=false;
 const x=run({first,second:first});
 const result=await x.report;
 assert.equal(result.schools.length,1);
 assert.equal(x.calls.filter(c=>c.startsWith("REPORT:")).length,1);
});
test("deactivated school in load report denies before final publication",async()=>{
 const x=run({report:id=>reportFor(id,id===school2?12:12)});
 // A different school ID in a returned report is never accepted.
 const bad=run({report:id=>({...reportFor(id),school:{id:school1,name:"Wrong",is_active:true}})});
 await assert.rejects(bad.report,/FEDERATION_SCHOOL_INACTIVE_OR_MISMATCH/);
 await x.report;
});

test("federation reporting orchestration is explicitly server-only",()=>{
 const source=readFileSync("lib/reports/federation-report-service.ts","utf8");
 assert.match(source,/^import ["']server-only["'];/m);
 const fs=requireFileGuards();
 assert.equal(fs.authenticatedIdentityFromClient, false);
});
function requireFileGuards(){
 const source=readFileSync("lib/reports/federation-report-service.ts","utf8");
 return {authenticatedIdentityFromClient:/fetch\s*\(.*\/auth\/v1\/user/.test(source)};
}
