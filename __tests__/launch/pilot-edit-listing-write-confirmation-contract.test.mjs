import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const source=readFileSync("components/marketplace/edit-listing-form.tsx","utf8");
const begin=source.indexOf("const handleSubmit = async");
const end=source.indexOf("\n  return (",begin);
assert.ok(begin>0&&end>begin);
const submit=source.slice(begin,end);

test("editor is syntactically valid TSX",()=>{
 const r=ts.transpileModule(source,{fileName:"edit-listing-form.tsx",reportDiagnostics:true,compilerOptions:{
  jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 assert.equal((r.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
});
test("editor confirms affected seller-owned listing before modifying any photos",()=>{
 const firstWrite=submit.indexOf('.update(updatePayload)');
 const result=submit.indexOf('if (updateError || !updatedListing)');
 const photoChange=submit.indexOf('.from("listing_photos")');
 assert.ok(firstWrite>=0&&result>firstWrite&&photoChange>result);
 const beforePhotos=submit.slice(firstWrite,photoChange);
 assert.match(beforePhotos,/\.eq\("id", initialListing\.id\)/);
 assert.match(beforePhotos,/\.eq\("seller_id", currentUserId\)/);
 assert.match(beforePhotos,/\.select\("id"\)\s*\.maybeSingle\(\)/);
});
test("deleted photo IDs are also strictly scoped to the edited listing",()=>{
 assert.match(submit,/\.from\("listing_photos"\)\s*\.delete\(\)\s*\.eq\("listing_id", initialListing\.id\)\s*\.in\("id", removedPhotoIds\)/);
 assert.doesNotMatch(submit,/\.from\("listing_photos"\)\.delete\(\)\.in\("id", removedPhotoIds\)/);
});
test("photo URL sync verifies a row was updated before redirect",()=>{
 const photoSync=submit.indexOf(".update({ photos: photoUrls");
 const confirmation=submit.indexOf("if (photoSyncError || !photosSyncedListing)");
 const navigation=submit.indexOf("router.push(");
 assert.ok(photoSync>=0&&confirmation>photoSync&&navigation>confirmation);
 assert.match(submit.slice(photoSync,confirmation),/\.select\("id"\)\s*\.maybeSingle\(\)/);
});
test("errors displayed to families do not contain SQL messages",()=>{
 assert.match(submit,/setSubmitError\("No se pudo actualizar el anuncio\. Inténtalo de nuevo\."\)/);
 assert.doesNotMatch(submit,/setSubmitError\(error\.message|setSubmitError\(error\?\.message/);
});
