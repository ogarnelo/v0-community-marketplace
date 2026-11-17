import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const ts=require("typescript");
const path="components/admin/federation-dashboard-local-demo.tsx";
const routePath="app/internal/federation-report-preview/page.tsx";
const demoSource=readFileSync(path,"utf8"),routeSource=readFileSync(routePath,"utf8");
const load=(src,env={NODE_ENV:"development"})=>{
 const mod={exports:{}};
 const transpiled=ts.transpileModule(src,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
 }).outputText;
 vm.runInNewContext(transpiled,{module:mod,exports:mod.exports,
  require:name=>{
   if(name==="@/components/admin/federation-kpi-dashboard")return {FederationKpiDashboard:()=>null};
   if(name==="@/components/admin/federation-dashboard-local-demo")return {FederationDashboardLocalDemo:()=>null};
   if(name==="@/lib/reports/federation-dashboard-view-model")return {buildFederationDashboardModel:x=>x};
   if(name==="next/navigation")return {notFound:()=>{throw Error("NOT_FOUND")}};
   return require(name);
  },
  process:{env},Object,Set,Intl,Error,
 },{timeout:1000});
 return mod.exports;
};
const data=load(demoSource);
test("synthetic demo is complete, reconciled, and has no real-user fields",()=>{
 const report=data.makeSyntheticFederationReport("365d","complete");
 assert.equal(report.schools.length,2);
 assert.equal(report.totalSuppressed,false);
 assert.equal(report.total.reusedItems,report.total.soldItems+report.total.donatedItems);
 assert.ok(report.schools.every(s=>s.schoolName.includes("(sintético)")));
 assert.doesNotMatch(JSON.stringify(report),/email|phone|private|users|password|service_role/);
});
test("suppression mode withholds small school's metrics and entire federation total",()=>{
 const report=data.makeSyntheticFederationReport("90d","suppressed");
 assert.equal(report.schools[1].suppressed,true);
 assert.equal(report.schools[1].metrics,null);
 assert.equal(report.total,null);
 assert.equal(report.totalSuppressed,true);
});
test("synthetic period switching changes metrics without external reads",()=>{
 const a=data.makeSyntheticFederationReport("90d","complete");
 const b=data.makeSyntheticFederationReport("365d","complete");
 const c=data.makeSyntheticFederationReport("total","complete");
 assert.ok(a.total.reusedItems<b.total.reusedItems);
 assert.ok(b.total.reusedItems<c.total.reusedItems);
 assert.equal(c.start,null);
});
test("preview route returns 404 in production and has no alternate deployment override",()=>{
 const page=load(routeSource,{NODE_ENV:"production"});
 assert.throws(()=>page.default(),/NOT_FOUND/);
 assert.match(routeSource,/process\.env\.NODE_ENV\s*!==\s*"development"/);
 assert.match(routeSource,/notFound\(\)/);
 assert.match(routeSource,/force-dynamic/);
 assert.match(routeSource,/index:false,follow:false/);
 assert.doesNotMatch(routeSource,/FEDERATION_REPORTING_ENABLED|ALLOW_PREVIEW|NEXT_PUBLIC_/);
});
test("preview route works in local development without connecting to Supabase",()=>{
 const page=load(routeSource,{NODE_ENV:"development"});
 const result=page.default();
 assert.ok(result && typeof result==="object");
 assert.doesNotMatch(routeSource+demoSource,/createAdminClient|createClient\s*\(|service_role|fetch\s*\(/);
});
