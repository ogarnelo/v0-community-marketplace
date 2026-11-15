import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const source=readFileSync("components/marketplace/edit-listing-form.tsx","utf8");
const first=source.indexOf("  const handleSubmit = async");
const last=source.indexOf("\n  return (", first);
assert.ok(first>0 && last>first, "Editor submit must be present");
const submit=source.slice(first,last);

test("editor TSX parses with no diagnostics",()=>{
 const out=ts.transpileModule(source,{fileName:"edit-listing-form.tsx",reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}});
 assert.equal((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
});
test("confirm owner listing UPDATE before attempting any photo changes",()=>{
 const confirmed=submit.indexOf('if (updateError || !updatedListing)');
 const upload=submit.indexOf('await uploadNewPhotos()');
 assert.ok(confirmed>0 && upload>confirmed);
});
test("upload replacement images before deleting any existing photo row",()=>{
 const upload=submit.indexOf('const uploadedRows = await uploadNewPhotos()');
 const insert=submit.indexOf('.from("listing_photos").insert(uploadedRows)');
 const deletion=submit.indexOf('.from("listing_photos")\n          .delete()');
 assert.ok(upload>=0 && insert>upload && deletion>insert,
  "New uploads and their DB rows must precede destructive deletion");
});
test("failed new photo insert must prevent old-photo deletion",()=>{
 const insert=submit.indexOf('.from("listing_photos").insert(uploadedRows)');
 const guard=submit.indexOf('if (error) throw error;',insert);
 const deletion=submit.indexOf('.delete()',insert);
 assert.ok(insert>=0 && guard>insert && deletion>guard);
});
test("old-photo deletion and reordering remain limited to this listing",()=>{
 const start=submit.indexOf('if (removedPhotoIds.length > 0)');
 const end=submit.indexOf('const photoUrls = [',start);
 const segment=submit.slice(start,end);
 assert.match(segment,/\.eq\("listing_id", initialListing\.id\)/);
 assert.match(segment,/\.in\("id", removedPhotoIds\)/);
 assert.match(segment,/\.eq\("id", photo\.id\)/);
});
test("listing photo array sync only after replacement and ownership-confirmed cleanup",()=>{
 const deleteOld=submit.indexOf('if (removedPhotoIds.length > 0)');
 const sync=submit.indexOf('.update({ photos: photoUrls');
 const confirm=submit.indexOf('if (photoSyncError || !photosSyncedListing)');
 assert.ok(deleteOld>0 && sync>deleteOld && confirm>sync);
});
