import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const page=readFileSync("app/marketplace/new/page.tsx","utf8");
const form=readFileSync("components/marketplace/new-listing-form.tsx","utf8");
test("multi-school publishing is OFF by default and requires a deliberate server flag",()=>{
 assert.match(page,/process\.env\.WETUDY_MULTISCHOOL_LISTINGS_ENABLED === "true"/);
 assert.match(page,/!managedSchoolId/);
 assert.match(page,/\.eq\("owner_user_id", user\.id\)/);
 assert.match(page,/\.eq\("active", true\)/);
 assert.match(page,/\.eq\("is_active", true\)/);
 assert.match(page,/\.eq\("is_listed", true\)/);
 assert.match(page,/\.limit\(100\)/);
 assert.match(page,/availableSchoolContexts=\{availableSchoolContexts\}/);
});
test("selector only emits exact verified operational or directory contexts",()=>{
 assert.match(form,/availableSchoolContexts\.find\(\(school\) => school\.key === selectedContextKey\)/);
 assert.match(form,/onValueChange=\{setSelectedContextKey\}/);
 assert.match(form,/school_id: effectiveSchoolId/);
 assert.match(form,/directory_school_code: directorySchoolCode/);
 assert.match(form,/selectedContextKey !== "no-school"/);
 assert.match(form,/LISTING_SCHOOL_CONTEXT_NOT_AUTHORIZED/);
 assert.match(form,/Material general \(sin colegio\)/);
 assert.match(form,/No es necesario seleccionar un estudiante/);
});
test("school admins retain managed-centre lock and no multi-school picker",()=>{
 assert.match(form,/multischoolSelectorEnabled && !isSchoolAdmin/);
 assert.match(form,/LISTING_SCHOOL_ADMIN_CONTEXT_CHANGED/);
 assert.match(page,/resolveUniqueSchoolAdminSchoolId/);
});
test("new page and form remain TSX parseable",()=>{
 for(const [name,s] of [["page",page],["form",form]]){
  const r=ts.transpileModule(s,{fileName:name+".tsx",reportDiagnostics:true,
   compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.equal((r.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,name);
 }
});
