import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const read = (path) => readFileSync(path, "utf8");
const route = read("app/api/marketplace/feed/route.ts");
const client = read("components/marketplace/marketplace-client.tsx");
const migration = read("supabase/migrations/20261109232000_marketplace_global_nearest_v1.sql");
const centroidData = read("lib/marketplace/postal-centroids.ts");

test("nearest without radius orders the full eligible listing set on the server", () => {
  assert.match(client, /sortBy === "distance" && initialHasKnownPostalCode && !onlyMyCommunity/);
  assert.match(client, /params\.set\("sort", "distance"\)/);
  assert.match(client, /if \(value === "distance" && !hasViewerPostalCode\)/);
  assert.match(client, /explainMissingPostalCode\(\)/);
  assert.doesNotMatch(client, /sortBy === "distance" && !radiusIsActive/);
  assert.match(route, /const nearestNoRadius = radiusKm === null && params\.get\("sort"\) === "distance"/);
  assert.match(route, /nearestNoRadius \? "marketplace_nearest_listing_page_v1"/);
  assert.match(route, /radiusKm !== null \|\| nearestNoRadius/);
  assert.match(migration, /p_sort = 'distance'/);
  assert.match(migration, /p_radius_km is null/);
  assert.match(migration, /left join public\.marketplace_postal_centroids candidate/);
  assert.match(migration, /st_distance\(candidate\.location, viewer\.location, false\) asc nulls last/);
  assert.match(migration, /l\.status = 'available'/);
  assert.match(migration, /limit least\(p_page_size, 61\) offset p_offset/);
  assert.match(migration, /language sql stable security invoker/);
  assert.match(migration, /revoke all on function public\.marketplace_nearest_listing_page_v1/);
  assert.match(migration, /grant execute on function public\.marketplace_nearest_listing_page_v1[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /create table|insert into|delete from/i);
});

test("5,040 synthetic entries page without duplicates or losing unknown locations", (t) => {
  // In-memory QA only: no synthetic accounts, listings or rows in production.
  const cps = ["28001","28010","28901","08001","04001","15001","41001","46001"];
  const locations = new Map();
  for (const cp of cps) {
    const m = centroidData.match(new RegExp('"' + cp + '": \\[(-?[\\d.]+), (-?[\\d.]+)\\]'));
    assert.ok(m, "missing postal centroid " + cp);
    locations.set(cp, [Number(m[1]), Number(m[2])]);
  }
  const source = locations.get("28001");
  const rad = Math.PI / 180;
  const distance = (cp) => {
    const target = locations.get(cp);
    if (!target) return null;
    const [a,b] = source, [c,d] = target;
    const x = Math.sin((c-a)*rad/2)**2 + Math.cos(a*rad)*Math.cos(c*rad) * Math.sin((d-b)*rad/2)**2;
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  };
  const entries = Array.from({length: 5040}, (_, i) => {
    const cp = i % 21 === 0 ? null : cps[i % cps.length];
    return {id: String(i).padStart(6,"0"), cp, createdAt: 5040-i, distance: distance(cp)};
  });
  const start = performance.now();
  entries.sort((a,b) =>
    (a.distance ?? Infinity) - (b.distance ?? Infinity) ||
    b.createdAt-a.createdAt ||
    b.id.localeCompare(a.id)
  );
  const pages = [];
  for (let offset=0; offset < entries.length; offset+=60) {
    const window = entries.slice(offset, offset+61);
    pages.push(...window.slice(0,60));
    const hasMore = window.length > 60;
    assert.equal(hasMore, offset+60 < entries.length);
  }
  const ms = performance.now()-start;
  t.diagnostic("Synthetic 5040-entry sort and 60-card pagination: "+ms.toFixed(2)+" ms (local model; not a PostGIS benchmark)");
  assert.equal(pages.length, entries.length);
  assert.equal(new Set(pages.map(x=>x.id)).size, entries.length);
  assert.equal(pages[0].distance, 0);
  assert.equal(pages.at(-1).distance, null);
  for (let i=1;i<pages.length;i++) {
    assert.ok((pages[i-1].distance ?? Infinity) <= (pages[i].distance ?? Infinity));
  }
});
