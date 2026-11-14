import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const profile=readFileSync("app/profile/[id]/page.tsx","utf8");
test("public profile review references never disclose nonavailable listing titles through admin",()=>{
  assert.match(profile,/admin\.from\("listings"\)\.select\("id, title"\)\.in\("id", reviewListingIds\)\.eq\("status", "available"\)/);
  assert.match(profile,/listing\.title \|\| "Anuncio"/);
  assert.match(profile,/reviewListingMap\.get\(/);
});
test("seller public list remains limited to available, with photo ids scoped",()=>{
  assert.match(profile,/\.eq\("seller_id", id\)[\s\S]{0,90}\.eq\("status", "available"\)/);
  assert.match(profile,/\.in\("listing_id", activeListingIds\)/);
});
