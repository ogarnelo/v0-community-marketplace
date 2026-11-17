import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const ts=createRequire(import.meta.url)("typescript");
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
const exp={},source=readFileSync("lib/reports/federation-kpi-projection.ts","utf8");
const transpile=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
vm.runInNewContext(transpile.outputText,{exports:exp,Number,Set,Error},{filename:"kpi.js",timeout:1500});
const row=(schoolId,members=15)=>({schoolId,schoolName:"Centro sintético",members,
 reusedItems:4,donatedItems:2,soldItems:2,circularValue:25,
 estimatedAvoidedCo2:8.4,activeListings:3,listingViews:12,
 email:"private@example.invalid",userId:"SENSITIVE"});
test("projection emits KPI allowlist and never member count, emails, IDs or arbitrary fields",()=>{
 const rows=exp.projectFederationSchoolKpis([row(a)],[a]);
 assert.equal(rows.length,1);
 const d=rows[0];
 assert.equal(d.schoolId,a);assert.equal(d.metrics.reusedItems,4);
 assert.equal("members" in d.metrics,false);
 assert.doesNotMatch(JSON.stringify(d),/private@example|SENSITIVE|members|userId/);
});
test("unrepresented school fails closed even when other represented data exists",()=>{
 assert.throws(()=>exp.projectFederationSchoolKpis([row(a),row(b)],[a]),/FEDERATION_REPORT_SCOPE_DENIED/);
});
test("small cell suppressed and federation aggregate blocked against subtraction",()=>{
 const view=exp.projectFederationSchoolKpis([row(a),row(b,5)],[a,b]);
 assert.equal(view[1].metrics,null);assert.equal(view[1].suppressed,true);
 assert.equal(exp.sumFederationKpis(view,[a,b]),null);
});
test("missing represented school, empty scope and duplicate row fail closed",()=>{
 const one=exp.projectFederationSchoolKpis([row(a)],[a]);
 assert.equal(exp.sumFederationKpis(one,[a,b]),null);
 assert.equal(exp.sumFederationKpis([],[]),null);
 assert.throws(()=>exp.projectFederationSchoolKpis([row(a),row(a)],[a]),/DUPLICATE_SCHOOL_METRICS/);
 assert.equal(exp.sumFederationKpis([one[0],one[0]],[a,b]),null);
});
test("valid full scope produces additive only verified metrics",()=>{
 const view=exp.projectFederationSchoolKpis([row(b),row(a)],[a,b]);
 const sum=exp.sumFederationKpis(view,[a,b]);
 assert.equal(sum.reusedItems,8);assert.equal(sum.soldItems,4);
 assert.equal(sum.circularValue,50);assert.equal(sum.estimatedAvoidedCo2,16.8);
});
test("malformed, negative, Infinity and NaN metrics are rejected",()=>{
 for(const m of [{...row(a),reusedItems:-1},{...row(a),circularValue:Infinity},
   {...row(a),members:NaN},{...row(a),schoolId:"not-a-uuid"}])
   assert.throws(()=>exp.projectFederationSchoolKpis([m],[a]),/INVALID_REPORTING_METRIC/);
});

test("integer overflow across valid schools suppresses totals rather than rounding",()=>{
 const large={...row(a),reusedItems:Number.MAX_SAFE_INTEGER};
 const views=exp.projectFederationSchoolKpis([large,row(b)],[a,b]);
 assert.equal(exp.sumFederationKpis(views,[a,b]),null);
});
test("floating-point overflow across valid schools suppresses totals",()=>{
 const large={...row(a),circularValue:Number.MAX_VALUE};
 const views=exp.projectFederationSchoolKpis([large,{...row(b),circularValue:Number.MAX_VALUE}],[a,b]);
 assert.equal(exp.sumFederationKpis(views,[a,b]),null);
});

test("sale plus donation must equal confirmed reused items",()=>{
 for(const bad of [
  {...row(a),reusedItems:4,donatedItems:1,soldItems:2},
  {...row(a),reusedItems:4,donatedItems:3,soldItems:2},
  {...row(a),reusedItems:0,donatedItems:1,soldItems:0},
 ]){
  assert.throws(()=>exp.projectFederationSchoolKpis([bad],[a]),/INVALID_REPORTING_METRIC/);
 }
});
test("agreement count arithmetic overflows before it may be published",()=>{
 const bad={...row(a),reusedItems:Number.MAX_SAFE_INTEGER,
   soldItems:Number.MAX_SAFE_INTEGER,donatedItems:1};
 assert.throws(()=>exp.projectFederationSchoolKpis([bad],[a]),/INVALID_REPORTING_METRIC/);
});
