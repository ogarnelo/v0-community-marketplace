import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const load=(path,requires={})=>{
 const ex={};
 const code=ts.transpileModule(readFileSync(path,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports:ex,require:name=>{
  assert.ok(name in requires,"missing dependency "+name);return requires[name];
 },Set,Map,Date,Number,Error},{timeout:1500});
 return ex;
};
const core=load("lib/reports/federation-reporting-scope.ts");
const h=load("lib/reports/federation-reporting-hierarchy.ts",{
 "./federation-reporting-scope":core,
});
const user="11111111-1111-4111-8111-111111111111";
const root="22222222-2222-4222-8222-222222222222";
const child="33333333-3333-4333-8333-333333333333";
const other="44444444-4444-4444-8444-444444444444";
const school="55555555-5555-4555-8555-555555555555";
const school2="66666666-6666-4666-8666-666666666666";
const when=new Date("2026-11-17T12:00:00Z");
const membership=[{userId:user,federationId:root,state:"active",role:"report_viewer"}];
const link={parentId:root,childId:child,status:"verified",startsAt:"2026-01-01T00:00:00Z",endsAt:null};
const reps=[{federationId:child,schoolId:school,state:"active",startsAt:"2026-01-01T00:00:00Z",endsAt:null},
 {federationId:other,schoolId:school2,state:"active",startsAt:"2026-01-01T00:00:00Z",endsAt:null}];
const resolve=(args={})=>Array.from(h.resolveHierarchySchoolScope({
 userId:user,rootFederationId:root,memberships:membership,
 links:[link],representations:reps,now:when,...args,
}));
test("verified federation path allows only descendant school, not unrelated federation",()=>{
 assert.deepEqual(resolve(),[school]);
});
test("revoked, pending, expired or future hierarchy never grants descendant",()=>{
 for(const change of [
  {status:"revoked"},{status:"pending"},
  {endsAt:"2026-11-01T00:00:00Z"},{startsAt:"2027-01-01T00:00:00Z"},
 ]){
  assert.deepEqual(resolve({links:[{...link,...change}]}),[]);
 }
});
test("root membership required; operator and revoked do not inherit reporting scope",()=>{
 for(const item of [{...membership[0],role:"operator"},{...membership[0],state:"revoked"},
  {...membership[0],userId:other}]){
  assert.deepEqual(resolve({memberships:[item]}),[]);
 }
});
test("cycles, self-links, or multiple parents fail closed",()=>{
 assert.deepEqual(resolve({links:[link,{...link,parentId:child,childId:root}]}),[]);
 assert.deepEqual(resolve({links:[{...link,childId:root}]}),[]);
 assert.deepEqual(resolve({links:[link,{...link,parentId:other}]}),[]);
});
test("revoked school representation and revoked parent scope fail closed",()=>{
 assert.deepEqual(resolve({representations:reps.map(x=>({...x,state:"revoked"}))}),[]);
 assert.deepEqual(resolve({links:[{...link,status:"pending"}]}),[]);
});

test("verified hierarchy edge shadowed by revoked copy fails closed",()=>{
 assert.deepEqual(resolve({links:[link,{...link,status:"revoked"}]}),[]);
 assert.deepEqual(resolve({links:[{...link,status:"revoked"},link]}),[]);
});
test("duplicate verified edges and malformed edge identity fail closed",()=>{
 assert.deepEqual(resolve({links:[link,{...link}]}),[]);
 assert.deepEqual(resolve({links:[{...link,childId:"not-a-uuid"}]}),[]);
});
