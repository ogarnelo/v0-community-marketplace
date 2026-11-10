import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(name, "utf8");
test("marketplace cards show approximate distance from listing postal zone, with seller fallback", () => {
  const serverPage = read("app/marketplace/page.tsx");
  const feed = read("app/api/marketplace/feed/route.ts");
  const schoolFeed = read("app/api/marketplace/my-school/route.ts");
  assert.match(serverPage, /currentSellerPostalCode =\s*item\.postal_code \|\|\s*sellerProfile\?\.postalCode/);
  assert.match(serverPage, /distance: approximateDistanceKm\(viewerPostalCode, currentSellerPostalCode\)/);
  assert.match(feed, /approximateDistanceKm\(\s*viewerPostalCode, item\.postal_code \|\| seller\?\.postalCode\)/);
  assert.match(schoolFeed, /approximateDistanceKm\(profile\?\.postal_code, item\.postal_code \|\| seller\?\.postalCode\)/);
  for (const file of [serverPage,feed,schoolFeed]) {
    assert.match(file, /postalCode: null, \/\//, "Never serialize the full postcode to client cards");
  }
});

test("global and radial SQL functions agree with published listing postcode", () => {
  const sql=read("supabase/migrations/20261110074207_marketplace_listing_cp_first.sql");
  const target="coalesce(nullif(l.postal_code, ''), nullif(seller.postal_code, ''))";
  assert.equal(sql.split(target).length - 1, 2);
  assert.equal((sql.match(/revoke all on function/g) || []).length, 2);
  assert.equal((sql.match(/security invoker/g) || []).length, 2);
  assert.doesNotMatch(sql, /coalesce\(nullif\(seller\.postal_code, ''\), nullif\(l\.postal_code, ''\)\)/);
  const benchmark=read(".github/workflows/pilot-marketplace-postgis-benchmark.yml");
  assert.match(benchmark, /pilot-marketplace-postcode-authority\.sql/);
  assert.match(benchmark, /20261110074207_marketplace_listing_cp_first\.sql/);
});
