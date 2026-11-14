import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const page = readFileSync("app/marketplace/page.tsx","utf8");
const feed = readFileSync("app/api/marketplace/feed/route.ts","utf8");
const sql = readFileSync("scripts/pilot-anon-listings-revoke-proposal.sql","utf8");
const fixture = readFileSync("scripts/pilot-marketplace-anon-revoke-qa.sql","utf8");
const workflow = readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
test("public homepage uses server-only listing reads; still filters available",()=>{
  assert.match(page,/const admin = createAdminClient\(\)/);
  assert.match(page,/const result = await admin\.from\("listings"\)/);
  assert.match(page,/const \{ data: listingsData, error: listingsError \} = await admin[\s\S]*?\.from\("listings"\)/);
  assert.doesNotMatch(page,/supabase\.from\("listings"\)/);
  assert.match(page,/\.eq\("status", "available"\)/);
});
test("feed uses server-only admin reads in BOTH radial and ordinary paths",()=>{
  assert.match(feed,/const admin = createAdminClient\(\)/);
  assert.match(feed,/const \{ data, error \} = await admin\.from\("listings"\)\.select\(FIELDS\)/);
  assert.match(feed,/admin\.from\("listings"\)\.select\(FIELDS\)\.eq\("status", "available"\)/);
  assert.doesNotMatch(feed,/supabase\.from\("listings"\)/);
});
test("radius remains authenticated with verified account CP, never caller-supplied",()=>{
  assert.match(feed,/if \(\(radiusKm !== null \|\| nearestNoRadius\) && !user\)/);
  assert.match(feed,/hasKnownPostalCode\(viewerPostalCode\)/);
  assert.match(feed,/p_postal_code: viewerPostalCode/);
  assert.match(feed,/const PAGE_SIZE = 60/);
  assert.match(feed,/\.range\(offset, offset \+ PAGE_SIZE\)/);
});
test("neither SSR cards nor API response sends full seller postcode",()=>{
  assert.match(page,/postalCode: null, \/\//);
  assert.match(feed,/postalCode: null, \/\//);
  assert.match(page,/distance: approximateDistanceKm\(viewerPostalCode, currentSellerPostalCode\)/);
  assert.match(feed,/nearbyDistances\.get\(item\.id\)/);
});
test("proposed SQL revokes tablewide anon SELECT and verifies 5 sensitive columns",()=>{
  assert.match(sql,/REVOKE SELECT ON TABLE public\.listings FROM anon/);
  assert.doesNotMatch(sql,/GRANT SELECT ON TABLE public\.listings TO anon/);
  for(const col of ["postal_code","lat","lng","seller_id","user_id"])
    assert.ok(sql.includes("has_column_privilege('anon','public.listings','"+col+"'"));
  assert.match(sql,/has_table_privilege\('authenticated','public\.listings','SELECT'\)/);
  assert.match(sql,/has_table_privilege\('service_role','public\.listings','SELECT'\)/);
});
test("isolated fixture proves denied SQL, retains other roles and rolls back",()=>{
  assert.match(fixture,/SET LOCAL ROLE anon/);
  assert.match(fixture,/EXCEPTION WHEN insufficient_privilege/);
  assert.match(fixture,/ROLLBACK/);
  assert.match(workflow,/pilot-marketplace-anon-revoke-qa\.sql/);
  const final=workflow.lastIndexOf(' -f scripts/pilot-marketplace-alert-full-schema-smoke.sql');
  const staged=workflow.indexOf(' -f scripts/pilot-marketplace-anon-revoke-qa.sql');
  assert.ok(staged>=0 && final>staged);
});
