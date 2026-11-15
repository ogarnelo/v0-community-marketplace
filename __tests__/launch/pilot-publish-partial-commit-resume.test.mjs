import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const create=readFileSync("components/marketplace/new-listing-form.tsx","utf8");
const page=readFileSync("app/marketplace/edit/[id]/page.tsx","utf8");
const edit=readFileSync("components/marketplace/edit-listing-form.tsx","utf8");
const start=create.indexOf("  const handleSubmit = async");
const end=create.indexOf("\n  return (",start);
assert.ok(start>0 && end>start);
const submit=create.slice(start,end);
test("all three edited TSX components parse without errors",()=>{
 for(const [name,src] of [
  ["new-listing-form.tsx",create],
  ["edit-listing-page.tsx",page],
  ["edit-listing-form.tsx",edit]
 ]) {
  const out=ts.transpileModule(src,{fileName:name,reportDiagnostics:true,
   compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,
    module:ts.ModuleKind.CommonJS}});
  assert.equal((out.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 }
});
test("track a committed listing only after a successful INSERT",()=>{
 const inserted=submit.indexOf('.from("listings").insert(payload)');
 const failed=submit.indexOf('if (insertError) throw insertError');
 const assigned=submit.indexOf('committedListingId = listingId');
 const photos=submit.indexOf('.from("listing_photos").insert(uploadedPhotoRows)');
 assert.ok(inserted>0 && failed>inserted && assigned>failed && photos>assigned);
});
test("on partial commit redirect to own listing editor, not publish another",()=>{
 assert.match(submit,/if \(committedListingId\) \{/);
 assert.match(submit,/router\.push\(`\/marketplace\/edit\/\$\{committedListingId\}\?photosPending=1`\)/);
 const branch=submit.slice(submit.indexOf("if (committedListingId)"),submit.indexOf('console.error("listing_publish_failed")'));
 assert.match(branch,/return;/);
 assert.doesNotMatch(branch,/setSubmitError/);
});
test("genuine failed listing INSERT retains normal nontechnical error",()=>{
 assert.match(submit,/console\.error\("listing_publish_failed"\)/);
 assert.match(submit,/setSubmitError\("No se pudo publicar el anuncio\./);
});
test("editor warning accepts only fixed server text after seller authorization",()=>{
 const auth=page.indexOf('if (typedListing.seller_id !== user.id)');
 const warning=page.indexOf('initialWarning={(await searchParams)?.photosPending === "1"');
 assert.ok(auth>0 && warning>auth);
 assert.match(page,/El anuncio ya está creado, pero no se pudieron terminar sus fotografías/);
 assert.match(page,/photosPending === "1"/);
});
test("warning is visible to seller and remains separate from edit validation errors",()=>{
 assert.match(edit,/initialWarning\?: string \| null/);
 assert.match(edit,/\{initialWarning \? <div role="alert"/);
 assert.match(edit,/\{submitError \? <div className="rounded-2xl bg-destructive/);
});
test("no rollback deletes uploaded photos after ambiguous listing INSERT",()=>{
 const committed=submit.indexOf('committedListingId = listingId');
 const later=submit.slice(committed);
 assert.doesNotMatch(later,/\.storage\.from\([^)]*\)\.remove\(/);
});
