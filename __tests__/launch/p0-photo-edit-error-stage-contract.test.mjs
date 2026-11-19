import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const s=readFileSync("components/marketplace/edit-listing-form.tsx","utf8");
const first=s.indexOf("  const handleSubmit =");
const last=s.indexOf("\n  return (",first);
assert.ok(first>0&&last>first,"edit handler present");
const fn=s.slice(first,last);
test("photo edit failure category is stable and never includes provider diagnostics",()=>{
 const phases=["listing","upload","photo_rows","remove","order","sync"];
 for(const phase of phases){
   assert.match(fn,new RegExp('\\b'+phase+': "[^"]+"'));
   assert.match(fn,new RegExp('savePhase = "'+phase+'"').source==="impossible"?/^$/:
     new RegExp(phase==="listing"?'savePhase: "listing"':'savePhase = "'+phase+'"'));
 }
 assert.match(fn,/setSubmitError\(safeMessages\[savePhase\]\)/);
 assert.doesNotMatch(fn,/setSubmitError\((?:updateError|photoSyncError|uploadError|error)(?:\.|\b)/);
 assert.match(fn,/Nunca|No se pudo|No se pudieron/);
});
test("phase markers preserve data-before-photo mutation order",()=>{
 const i=(text)=>fn.indexOf(text);
 assert.ok(i('savePhase = "upload"')>i('listing_update_not_confirmed'));
 assert.ok(i('savePhase = "photo_rows"')>i('savePhase = "upload"'));
 assert.ok(i('savePhase = "remove"')>i('savePhase = "photo_rows"'));
 assert.ok(i('savePhase = "order"')>i('savePhase = "remove"'));
 assert.ok(i('savePhase = "sync"')>i('savePhase = "order"'));
});
test("TSX still transpiles without parsing diagnostics",()=>{
 const result=ts.transpileModule(s,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},
  reportDiagnostics:true,
 });
 assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
});
