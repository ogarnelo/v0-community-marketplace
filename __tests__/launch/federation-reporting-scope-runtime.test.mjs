import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const a="11111111-1111-4111-8111-111111111111";
const b="22222222-2222-4222-8222-222222222222";
const school1="33333333-3333-4333-8333-333333333333";
const school2="44444444-4444-4444-8444-444444444444";
const school3="55555555-5555-4555-8555-555555555555";
const out={};
const src=readFileSync("lib/reports/federation-reporting-scope.ts","utf8");
const js=ts.transpileModule(src,{fileName:"scope.ts",compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
vm.runInNewContext(js.outputText,{exports:out,Date,Set,Number,Error},{filename:"scope.js",timeout:1000});
const now=new Date("2026-11-17T12:00:00Z");
const m=[{userId:a,federationId:b,role:"report_viewer",state:"active"}];
const rows=[
 {federationId:b,schoolId:school1,state:"active",startsAt:"2026-01-01T00:00:00Z",endsAt:null},
 {federationId:b,schoolId:school2,state:"revoked",startsAt:"2026-01-01T00:00:00Z",endsAt:null},
 {federationId:b,schoolId:school3,state:"active",startsAt:"2026-12-01T00:00:00Z",endsAt:null},
];
const scope=(memb=m,repr=rows)=>Array.from(out.resolveFederationSchoolScope({subjectUserId:a,federationId:b,memberships:memb,representations:repr,now}));
test("active, dated representation grants only the represented school",()=>{
 assert.deepEqual(scope(),[school1]);
 assert.equal(out.requireRepresentedSchool(scope(),school1),school1);
 assert.throws(()=>out.requireRepresentedSchool(scope(),school2),/FEDERATION_REPORT_SCOPE_DENIED/);
});
test("revoked, pending, operator, different user and different federation fail closed",()=>{
 for(const x of [{...m[0],state:"revoked"},{...m[0],role:"operator"},{...m[0],federationId:school2},{...m[0],userId:school3}]){
  assert.deepEqual(scope([x]),[]);
 }
});
test("expiry and malformed times never grant authority",()=>{
 for(const expiry of ["2026-11-17T12:00:00Z","not-a-time","2026-01-01T00:00:00Z"]){
  assert.deepEqual(scope(m,[{...rows[0],endsAt:expiry}]),[]);
 }
});
test("membership is not inferred from geographical location or request IDs",()=>{
 const allowed=scope(m,[{...rows[0],federationId:school2}]);
 assert.deepEqual(allowed,[]);
 assert.throws(()=>out.requireRepresentedSchool([school1],"no-id"),/DENIED/);
});
test("no duplicate school IDs and no automatic hierarchy inheritance",()=>{
 const allowed=scope(m,[rows[0],rows[0],{...rows[0],schoolId:school2,federationId:school3}]);
 assert.deepEqual(allowed,[school1]);
});
