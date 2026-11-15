import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const source=readFileSync("components/marketplace/edit-listing-form.tsx","utf8");
const beginRestore=source.indexOf("const handleRestorePhotoMetadata = async");
const beginSave=source.indexOf("const handleSubmit = async");
const beginMarkup=source.indexOf("\n  return (",beginSave);
assert.ok(beginRestore>0&&beginSave>beginRestore&&beginMarkup>beginSave);
const restore=source.slice(beginRestore,beginSave);
const submit=source.slice(beginSave,beginMarkup);
test("editor TSX remains syntactically valid",()=>{
 const result=ts.transpileModule(source,{fileName:"edit-listing-form.tsx",reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
});
test("editor uses synchronous refs rather than lagging React saving state",()=>{
 assert.match(source,/const saveInFlightRef = useRef\(false\)/);
 assert.match(source,/const recoveryInFlightRef = useRef\(false\)/);
 assert.match(submit,/if \(saveInFlightRef\.current \|\| recoveryInFlightRef\.current\) return;/);
 assert.doesNotMatch(submit,/if \(saving\) return;/);
});
test("save lock is claimed before state updates, DB writes or photo uploads",()=>{
 const guarded=submit.indexOf("if (saveInFlightRef.current || recoveryInFlightRef.current) return");
 const locked=submit.indexOf("saveInFlightRef.current = true");
 const state=submit.indexOf("setSaving(true)");
 const upload=submit.indexOf("await uploadNewPhotos()");
 assert.ok(guarded>=0&&locked>guarded&&state>locked&&upload>state);
});
test("save lock is always released even if the database or upload fails",()=>{
 assert.match(submit,/finally \{\s*saveInFlightRef\.current = false;\s*setSaving\(false\)/);
});
test("recovery lock excludes simultaneous save and any overlapping recovery request",()=>{
 assert.match(restore,/if \(recoveryInFlightRef\.current \|\| saveInFlightRef\.current\) return;/);
 const guard=restore.indexOf("if (recoveryInFlightRef.current || saveInFlightRef.current)");
 const locked=restore.indexOf("recoveryInFlightRef.current = true");
 const auth=restore.indexOf("supabase.auth.getUser()");
 assert.ok(guard>=0&&locked>guard&&auth>locked);
 assert.match(restore,/finally \{\s*recoveryInFlightRef\.current = false;\s*setRestoringPhotoMetadata\(false\)/);
});
test("save and cancel buttons are disabled while either mutation is active",()=>{
 assert.equal(source.split("disabled={saving || restoringPhotoMetadata}").length-1,2);
 assert.match(source,/disabled=\{restoringPhotoMetadata \|\| saving\}/);
});
