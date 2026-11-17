import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const ts=createRequire(import.meta.url)("typescript");
function compile(path,requires={}){
 const out={};
 const js=ts.transpileModule(readFileSync(path,"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports:out,require:(name)=>{assert.ok(name in requires,name);return requires[name]},
 Date,Set,Number,Error},{timeout:2000});
 return out;
}
const scope=compile("lib/reports/federation-reporting-scope.ts");
const filters=compile("lib/reports/federation-report-filters.ts",{"./federation-reporting-scope":scope});
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
const now=new Date("2026-11-17T12:00:00.000Z");
const parse=(overrides={})=>filters.parseFederationReportFilter({now,allowedSchoolIds:[a,b],...overrides});
test("default 365d all represented schools without trusting unbounded dates",()=>{
 const result=parse();
 assert.equal(result.period,"365d");
 assert.deepEqual(Array.from(result.schoolIds),[a,b]);
 assert.equal(result.end,"2026-11-17T12:00:00.000Z");
 assert.equal(new Date(result.end).getTime()-new Date(result.start).getTime(),365*86400000);
});
test("single school must be represented, even when UUID syntax is valid",()=>{
 assert.deepEqual(Array.from(parse({period:"90d",schoolId:a}).schoolIds),[a]);
 assert.throws(()=>parse({schoolId:"33333333-3333-4333-8333-333333333333"}),/FEDERATION_REPORT_SCOPE_DENIED/);
});
test("reject arbitrary ranges, arrays and unknown periods",()=>{
 for (const p of ["1d","yesterday","",90,["90d"],{days:90}])
   assert.throws(()=>parse({period:p}),/INVALID_REPORT_PERIOD/);
 assert.throws(()=>parse({schoolId:[a,b]}),/INVALID_REPORT_SCHOOL/);
});
test("fail closed on missing, duplicate or oversized representation scope",()=>{
 assert.throws(()=>parse({allowedSchoolIds:[]}),/INVALID_REPORT_SCOPE/);
 assert.throws(()=>parse({allowedSchoolIds:[a,a]}),/INVALID_REPORT_SCOPE/);
 assert.throws(()=>parse({allowedSchoolIds:Array.from({length:501},(_,i)=>i.toString())}),/INVALID_REPORT_SCOPE/);
});
test("total and 90d only produce bounded server-authorized periods",()=>{
 assert.equal(parse({period:"total"}).start,null);
 const result=parse({period:"90d"});
 assert.equal(new Date(result.end).getTime()-new Date(result.start).getTime(),90*86400000);
});
