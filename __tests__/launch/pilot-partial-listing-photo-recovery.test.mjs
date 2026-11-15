import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {missingListingPhotoMetadata} from "../../lib/marketplace/missing-listing-photos.mjs";
const ts=createRequire(import.meta.url)("typescript");
const a="https://files.example.invalid/storage/v1/object/public/listing-photos/u/l/a.jpg";
const b="https://files.example.invalid/storage/v1/object/public/listing-photos/u/l/b.jpg";
const c="https://files.example.invalid/storage/v1/object/public/listing-photos/u/l/c.jpg";

test("fully persisted photo rows require no repair",()=>{
 assert.deepEqual(missingListingPhotoMetadata([a,b],[{url:a},{url:b}]),[]);
});
test("only missing photo URLs are restored with original sort position",()=>{
 assert.deepEqual(missingListingPhotoMetadata([a,b,c],[{url:a},{url:c}]),[{url:b,sort_order:1}]);
});
test("a completely missing metadata set restores only saved listing photos",()=>{
 assert.deepEqual(missingListingPhotoMetadata([a,b],[]),[
  {url:a,sort_order:0},{url:b,sort_order:1}]);
});
test("never copy malformed, non-HTTPS or duplicated photo URLs",()=>{
 assert.deepEqual(missingListingPhotoMetadata([a,"http://insecure.invalid/x",a,"javascript:alert(1)",b],[]),[
  {url:a,sort_order:0},{url:b,sort_order:4}]);
});
test("no array or more than eight links cannot trigger mass repair",()=>{
 assert.deepEqual(missingListingPhotoMetadata("unsafe",[]),[]);
 const photos=Array.from({length:15},(_,i)=>"https://files.example.invalid/"+i+".jpg");
 assert.equal(missingListingPhotoMetadata(photos,[]).length,8);
});
test("the editing server checks owner before computing missing photo metadata",()=>{
 const src=readFileSync("app/marketplace/edit/[id]/page.tsx","utf8");
 const owner=src.indexOf("if (typedListing.seller_id !== user.id)");
 const recovery=src.indexOf("const recoverablePhotoRows = missingListingPhotoMetadata(");
 assert.ok(owner>0&&recovery>owner);
 assert.match(src,/status, photos"/);
 assert.match(src,/recoverablePhotoRows=\{recoverablePhotoRows\}/);
});
test("recovery fetches source of truth with seller RLS before inserting metadata",()=>{
 const src=readFileSync("components/marketplace/edit-listing-form.tsx","utf8");
 const begin=src.indexOf("const handleRestorePhotoMetadata = async");
 const end=src.indexOf("const handleSubmit = async",begin);
 assert.ok(begin>=0&&end>begin);
 const code=src.slice(begin,end);
 assert.match(code,/supabase\.auth\.getUser\(\)/);
 assert.match(code,/user\.id !== currentUserId/);
 assert.match(code,/\.from\("listings"\)/);
 assert.match(code,/\.select\("id,seller_id,photos"\)/);
 assert.match(code,/\.eq\("seller_id", currentUserId\)/);
 assert.match(code,/ownListing\.seller_id !== user\.id/);
 assert.match(code,/missingListingPhotoMetadata\(ownListing\.photos, existingRows \|\| \[\]\)/);
 assert.ok(code.indexOf('select("id,seller_id,photos")')<code.indexOf('.insert(missing.map'));
 assert.doesNotMatch(code,/createAdminClient|storage\.from\([^)]*\)\.remove\(/);
});
test("repair requires explicit seller click, and failures remain generic",()=>{
 const src=readFileSync("components/marketplace/edit-listing-form.tsx","utf8");
 assert.match(src,/onClick=\{handleRestorePhotoMetadata\}/);
 assert.match(src,/disabled=\{restoringPhotoMetadata \|\| saving\}/);
 assert.match(src,/setPhotoRestoreError\("No se pudieron recuperar las fotografías/);
 assert.doesNotMatch(src,/setPhotoRestoreError\(.*(?:error\.message|error\.details)/);
});
test("the editing form and page remain valid TSX",()=>{
 for(const file of ["components/marketplace/edit-listing-form.tsx","app/marketplace/edit/[id]/page.tsx"]){
  const out=ts.transpileModule(readFileSync(file,"utf8"),{
    fileName:file,reportDiagnostics:true,compilerOptions:{
      target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}
  });
  assert.equal((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
 }
});
