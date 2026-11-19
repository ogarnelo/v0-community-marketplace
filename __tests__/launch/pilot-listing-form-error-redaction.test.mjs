import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const newListing=readFileSync("components/marketplace/new-listing-form.tsx","utf8");
const edit=readFileSync("components/marketplace/edit-listing-form.tsx","utf8");

test("new listing never reflects privileged provider exceptions in UI",()=>{
 assert.match(newListing,/setSubmitError\("No se pudo publicar el anuncio\./);
 assert.doesNotMatch(newListing,/error\?\.message|error\?\.details|error\?\.error_description/);
 assert.doesNotMatch(newListing,/console\.error\([^)]*,\s*(error|draftCleanupError)/);
});
test("edit listing keeps a generic actionable error",()=>{
 assert.match(edit,/setSubmitError\(safeMessages\[savePhase\]\)/);
 assert.match(edit,/listing: "No se pudieron guardar los datos del anuncio\./);
 assert.match(edit,/upload: "No se pudo subir la nueva fotografía\./);
 assert.doesNotMatch(edit,/error\?\.message|error\?\.details/);
});
test("draft controls do not surface arbitrary server failure text",()=>{
 assert.match(newListing,/setSubmitError\("No se pudo guardar el borrador\."\)/);
 assert.match(newListing,/setSubmitError\("No se pudo descartar el borrador\."\)/);
 assert.match(newListing,/console\.error\("listing_publish_failed"\)/);
});
