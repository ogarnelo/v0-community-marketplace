import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const src=readFileSync("lib/marketplace/school-scope.ts","utf8");
const route=readFileSync("app/api/marketplace/my-school/route.ts","utf8");
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const FOREIGN="33333333-3333-4333-8333-333333333333";
const observed=[];
const admin={from(table){
  assert.equal(table,"school_directory");
  let by=null,value=null;
  const q={select(){return q},eq(k,v){by=k;value=v;return q},
    limit(){return Promise.resolve({data:by==="linked_school_id"&&value===A?
      [{official_code:"28000001"}]:[],error:null})},
    async maybeSingle(){return {data:by==="official_code"&&value==="28000002"?
      {linked_school_id:B}:null,error:null}}};
  observed.push(q);return q;
}};
const exports={};
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
runInNewContext(js,{exports,require:id=>{
  if(id==="server-only")return {};
  if(id==="@/lib/supabase/admin")return {createAdminClient:()=>admin};
  throw Error("Unexpected require "+id);
}},{timeout:2500});
const {resolveMarketplaceMultiSchoolScope,makeMarketplaceSchoolFilter}=exports;
test("A plus a linked directory B includes only A and B, not another family's C",async()=>{
 const scope=await resolveMarketplaceMultiSchoolScope([
   {schoolId:A,directorySchoolCode:null},
   {schoolId:null,directorySchoolCode:"28000002"},
   {schoolId:A,directorySchoolCode:null},
 ]);
 assert.deepEqual(Array.from(scope.schoolIds).sort(),[A,B].sort());
 assert.deepEqual(Array.from(scope.directoryCodes).sort(),["28000001","28000002"].sort());
 const expression=makeMarketplaceSchoolFilter(scope);
 assert.match(expression,/school_id\.eq\.11111111/);
 assert.match(expression,/directory_school_code\.in\.\(28000001,28000002\)/);
 assert.doesNotMatch(expression,new RegExp(FOREIGN));
});
test("bad, conflicting and excessive student contexts fail closed",async()=>{
 for(const invalid of [
  [{schoolId:"../../admin",directorySchoolCode:null}],
  [{schoolId:A,directorySchoolCode:"28000002"}],
  Array(101).fill({schoolId:A,directorySchoolCode:null}),
 ]) {
  await assert.rejects(()=>resolveMarketplaceMultiSchoolScope(invalid));
 }
 const empty=await resolveMarketplaceMultiSchoolScope([{schoolId:null,directorySchoolCode:null}]);
 assert.equal(makeMarketplaceSchoolFilter(empty),null);
});
test("HTTP community feed takes school contexts from authenticated user only",()=>{
 assert.match(route,/WETUDY_MULTISCHOOL_LISTINGS_ENABLED === "true"/);
 assert.match(route,/\.eq\("owner_user_id", user\.id\)/);
 assert.match(route,/\.eq\("active", true\)/);
 assert.match(route,/\.limit\(101\)/);
 assert.match(route,/resolveMarketplaceMultiSchoolScope\(contexts\)/);
 assert.match(route,/resolveUniqueSchoolAdminSchoolId/);
 assert.doesNotMatch(route,/params\.get\("schoolId"\)/);
 assert.doesNotMatch(route,/params\.get\("directorySchoolCode"\)/);
 assert.match(route,/Cache-Control": "private, no-store"/);
});

test("server-rendered school counts share the exact authenticated union",()=>{
 const page=readFileSync("app/marketplace/page.tsx","utf8");
 const client=readFileSync("components/marketplace/marketplace-client.tsx","utf8");
 assert.match(page,/process\.env\.WETUDY_MULTISCHOOL_LISTINGS_ENABLED === "true"/);
 assert.match(page,/\.eq\("owner_user_id", user\.id\)\.eq\("active", true\)\.limit\(101\)/);
 assert.match(page,/resolveUniqueSchoolAdminSchoolId\(roles\.data\)/);
 assert.match(page,/resolveMarketplaceMultiSchoolScope\(multiCommunityContexts\)/);
 assert.match(page,/initialHasMultiSchoolContext=\{/);
 assert.match(client,/initialHasMultiSchoolContext = false/);
 assert.match(client,/currentUserDirectorySchoolCode \|\| initialHasMultiSchoolContext/);
 assert.match(page,/select\("id", \{ count: "exact", head: true \}\)/);
});
