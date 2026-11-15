import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(p,"utf8");
const home=read("app/marketplace/page.tsx");
const feed=read("app/api/marketplace/feed/route.ts");
const school=read("app/api/marketplace/my-school/route.ts");

test("homepage loads photo IDs through the server-only client",()=>{
 assert.match(home,/listingPhotosError \} = await admin/);
 assert.match(home,/\.in\("listing_id", listingIds\)/);
 assert.match(home,/\.eq\("status", "available"\)/);
 assert.doesNotMatch(home,/supabase\s*\.from\("listing_photos"\)/);
});
test("public feed loads only photos of listed available IDs",()=>{
 assert.match(feed,/ids\.length\s*\?\s*admin\.from\("listing_photos"\)/);
 assert.match(feed,/\.in\("listing_id", ids\)/);
 assert.match(feed,/\.eq\("status", "available"\)/);
 assert.match(feed,/postalCode: null, \/\//);
 assert.doesNotMatch(feed,/supabase\.from\("listing_photos"\)/);
});
test("school feed waits for auth and school scope before privileged photo lookup",()=>{
 const auth=school.indexOf("if (authError || !user)");
 const scope=school.indexOf("const expression = makeMarketplaceSchoolFilter");
 const query=school.indexOf('admin.from("listings")');
 const photos=school.indexOf('admin.from("listing_photos")');
 assert.ok(auth>=0 && scope>auth && query>scope && photos>query);
 assert.match(school,/\.in\("listing_id", ids\)/);
 assert.match(school,/postalCode: null, \/\//);
 assert.doesNotMatch(school,/supabase\.from\("listing_photos"\)/);
});
test("read-only SQL audit documents the photo RLS dependency",()=>{
 const src=read("scripts/pilot-listing-photos-rls-readonly.sql");
 assert.match(src,/pg_policies/);
 assert.match(src,/listing_photos/);
 assert.match(src,/READ ONLY/);
});