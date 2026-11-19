import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const draft=readFileSync("lib/marketplace/listing-draft.ts","utf8");
const form=readFileSync("components/marketplace/new-listing-form.tsx","utf8");
const api=readFileSync("app/api/marketplace/listing-draft/route.ts","utf8");
test("legacy drafts still parse and the selected school is metadata, not authorization",()=>{
 assert.match(draft,/schoolContextKey\?: string/);
 assert.match(draft,/schoolContextKey: ""/);
 assert.match(form,/schoolContextKey: multischoolSelectorEnabled \? selectedContextKey : ""/);
 assert.match(form,/key === "schoolContextKey" \? false/);
 assert.match(api,/\.eq\("user_id", user\.id\)/);
 assert.doesNotMatch(api,/\.from\("listings"\)\.insert\(payload\)/);
});
test("draft restore never accepts a revoked or fabricated school code",()=>{
 assert.match(form,/availableSchoolContexts\.some\(\(school\) => school\.key === savedSchoolKey\)/);
 assert.match(form,/savedSchoolKey === "no-school"/);
 assert.match(form,/\? savedSchoolKey : "no-school"/);
 assert.match(form,/if \(multischoolSelectorEnabled\) setSelectedContextKey\(safeSchoolKey\)/);
 assert.match(form,/schoolContextKey: multischoolSelectorEnabled \? safeSchoolKey : ""/);
 assert.match(form,/Tu colegio anterior ya no está autorizado/);
});
test("the school remains unchanged with selector OFF, including restored legacy drafts",()=>{
 assert.match(form,/selectedContext\?\.schoolId \|\| null : initialSchoolId \|\| null/);
 assert.match(form,/selectedContext\?\.directorySchoolCode \|\| null : initialDirectorySchoolCode \|\| null/);
 assert.match(form,/schoolContextKey: multischoolSelectorEnabled \? selectedContextKey : ""/);
});
test("new and old drafts remain syntactically compatible with TypeScript",()=>{
 for(const [name,src] of [["listing-draft.ts",draft],["form.tsx",form]]){
   const res=ts.transpileModule(src,{fileName:name,reportDiagnostics:true,
     compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
   assert.equal((res.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,name);
 }
});
