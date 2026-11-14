import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("scripts/pilot-privacy-prod-preflight-readonly.sql","utf8");
test("read-only production gate checks both geo RPCs and all roles",()=>{
 assert.match(source,/BEGIN TRANSACTION READ ONLY/);
 assert.ok(source.trim().endsWith("ROLLBACK;"));
 for(const s of ["marketplace_nearest_listing_page_v1","marketplace_nearby_listing_page_v1",
 "has_function_privilege('anon'","has_function_privilege('authenticated'",
 "has_function_privilege('service_role'","NO_GO_GEO_RPC","NO_GO_POSTAL_CENTROIDS"])
   assert.ok(source.includes(s),s);
});
test("server route requires verified account postcode before calling geo RPC",()=>{
 const feed=readFileSync("app/api/marketplace/feed/route.ts","utf8");
 const auth=feed.indexOf("if ((radiusKm !== null || nearestNoRadius) && !user)");
 const postal=feed.indexOf("hasKnownPostalCode(viewerPostalCode)");
 const rpc=feed.indexOf("await admin.rpc(");
 assert.ok(auth>=0&&postal>auth&&rpc>postal);
 assert.match(feed,/p_postal_code:\s*viewerPostalCode/);
 assert.doesNotMatch(feed,/p_postal_code:\s*params\.get\(/);
});
