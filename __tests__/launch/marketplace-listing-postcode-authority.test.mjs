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


test("authenticated publications snapshot verified profile CP and do not expose it in UI", () => {
  const migration = read("supabase/migrations/20261110113419_marketplace_listing_postal_snapshot_v1.sql");
  const workflow = read(".github/workflows/pilot-marketplace-alert-outbox.yml");
  const fixture = read("scripts/pilot-marketplace-postcode-snapshot.sql");
  const form = read("components/marketplace/new-listing-form.tsx");

  assert.match(migration, /create or replace function wetudy_internal\.marketplace_listing_postal_snapshot_v1/);
  assert.match(migration, /before insert on public\.listings/);
  assert.match(migration, /publishing_user uuid := auth\.uid\(\)/);
  assert.match(migration, /where p\.id = publishing_user/);
  assert.match(migration, /from public\.marketplace_postal_centroids/);
  assert.match(migration, /new\.postal_code := verified_postal_code/);
  assert.match(migration, /new\.postal_code := null/);
  assert.match(migration, /new\.is_demo is true/);
  assert.match(migration, /revoke all on function wetudy_internal\.marketplace_listing_postal_snapshot_v1/);
  assert.doesNotMatch(migration, /update public\.listings|insert into public\.listings/i);
  assert.match(workflow, /pilot-marketplace-postcode-snapshot\.sql/);
  assert.match(fixture, /Moving publisher moved an already published ad/);
  assert.match(fixture, /Invalid profile CP accepted arbitrary listing CP/);
  assert.match(fixture, /DEMO must retain explicit location and skip outbox/);
  // The CP is populated inside Supabase: never put a seller's full CP into
  // client form state, URLs or a new public request field.
  assert.doesNotMatch(form, /initialPostalCode|viewerPostalCode/);
});
