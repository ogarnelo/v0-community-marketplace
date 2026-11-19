import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const school1="11111111-1111-4111-8111-111111111111";
const school2="22222222-2222-4222-8222-222222222222";
const source=readFileSync("lib/marketplace/unique-school-admin-context.ts","utf8");
const route=readFileSync("app/marketplace/new/page.tsx","utf8");
const compiled=ts.transpileModule(source,{reportDiagnostics:true,
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const out={};
vm.runInNewContext(compiled.outputText,{exports:out,Array,Error},{timeout:1200});
test("zero school-admin rows allows ordinary family student context",()=>{
 assert.equal(out.resolveUniqueSchoolAdminSchoolId([]),null);
});
test("one exact school-admin scope is returned without modification",()=>{
 assert.equal(out.resolveUniqueSchoolAdminSchoolId([{school_id:school1}]),school1);
});
for(const [description,rows] of [
 ["two different schools",[{school_id:school1},{school_id:school2}]],
 ["two duplicate school grants",[{school_id:school1},{school_id:school1}]],
 ["malformed school grant",[{school_id:"forged"}]],
 ["null school grant",[{school_id:null}]],
 ["missing record",[{}]],
 ["missing page",null],
 ["truncated/undefined page",undefined],
 ["not an array",{school_id:school1}],
 ["oversized page",Array(3).fill({school_id:school1})],
]){
 test(description+" never selects an arbitrary managed school",()=>{
  assert.throws(()=>out.resolveUniqueSchoolAdminSchoolId(rows),
    /SCHOOL_ADMIN_CONTEXT/);
 });
}
test("new listing route refuses stale Auth and school-read outages",()=>{
 assert.match(route,/if \(authError\)/);
 assert.match(route,/LISTING_NEW_AUTH_UNAVAILABLE/);
 assert.match(route,/LISTING_NEW_PROFILE_UNAVAILABLE/);
 assert.match(route,/LISTING_NEW_ADMIN_ROLE_UNAVAILABLE/);
 assert.match(route,/LISTING_NEW_STUDENT_CONTEXT_UNAVAILABLE/);
 assert.match(route,/LISTING_NEW_DIRECTORY_CONTEXT_UNAVAILABLE/);
 assert.match(route,/LISTING_NEW_SCHOOL_CONTEXT_UNAVAILABLE/);
 assert.match(route,/resolveUniqueSchoolAdminSchoolId\(schoolAdminRoles\)/);
 assert.match(route,/\.limit\(2\)/);
 assert.doesNotMatch(route,/\.not\("school_id", "is", null\)[\s\S]*?\.limit\(1\)/);
});
