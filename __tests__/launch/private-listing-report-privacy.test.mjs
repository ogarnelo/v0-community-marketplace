import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const route=readFileSync("app/api/reports/route.ts","utf8");
test("privileged listing lookup checks visibility before creating any report",()=>{
  assert.match(route,/admin\s*\.from\("listings"\)\s*\.select\("id, status, seller_id"\)/);
  const privacy=route.indexOf('if (listing.status !== "available" && listing.seller_id !== user.id)');
  const insert=route.indexOf('.from("reports")\n      .insert(payload)');
  assert.ok(privacy>=0 && insert>privacy);
  assert.match(route,/return NextResponse.json\(\{ error: "El anuncio ya no existe\." \}, \{ status: 404 \}\)/);
});
test("buyer or seller in genuine conversation may report past negotiation",()=>{
  assert.match(route,/supabase\s*\.from\("conversations"\)\s*\.select\("id, buyer_id, seller_id"\)/);
  assert.match(route,/\.eq\("listing_id", targetId\)/);
  assert.match(route,/participantConversation\.buyer_id !== user\.id &&\s*participantConversation\.seller_id !== user\.id/);
  assert.doesNotMatch(route,/admin\s*\.from\("conversations"\)\s*\.select\("id, buyer_id, seller_id"\)\s*\.eq\("listing_id", targetId\)/);
});
test("direct conversation reports also require participant equality",()=>{
  assert.match(route,/conversation\.buyer_id !== user\.id && conversation\.seller_id !== user\.id/);
  assert.match(route,/MAX_REPORTS_PER_HOUR = 10/);
});
