import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");
const route = read("app/api/marketplace/saved-searches/route.ts");
const matchRoute = read("app/api/marketplace/listings/match-saved-searches/route.ts");
const client = read("components/marketplace/marketplace-client.tsx");
const account = read("components/account/saved-searches-list.tsx");
const accountPage = read("app/account/saved-searches/page.tsx");
const migration = read("supabase/migrations/20261110093000_saved_search_radius_km.sql");

const compiled = ts.transpileModule(
  read("lib/marketplace/saved-search-matching.ts"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;
const exports = {};
runInNewContext(compiled, { exports });
const { savedSearchMatchesListing } = exports;

const listing = {
  id: "demo", title: "Polo azul talla 12", description: "Uniforme escolar",
  category: "Uniformes", grade_level: "Primaria", condition: "used", type: "sale",
};

test("saved search radius is enforced for future listing match and missing geodata fails closed", () => {
  const search = { id: "s", query: "Polo", radius_km: 10 };
  assert.equal(savedSearchMatchesListing(search, listing, 0), true);
  assert.equal(savedSearchMatchesListing(search, listing, 9.9), true);
  assert.equal(savedSearchMatchesListing(search, listing, 10), true);
  assert.equal(savedSearchMatchesListing(search, listing, 10.1), false);
  assert.equal(savedSearchMatchesListing(search, listing, NaN), false);
  assert.equal(savedSearchMatchesListing(search, listing), false);
  assert.equal(savedSearchMatchesListing({ ...search, radius_km: null }, listing), true);
  assert.equal(savedSearchMatchesListing({ ...search, query: "Mochila" }, listing, 0), false);
});

test("zero-results descriptions are accepted and used as a matching criterion, not just metadata", () => {
  assert.match(route, /const matchingQuery = query \|\|/);
  assert.match(route, /needDetails\?\.slice\(0, 160\)/);
  assert.match(route, /!query && !isbnQuery && !category && !gradeLevel && !needDetails/);
  assert.match(route, /query: matchingQuery/);
  assert.match(route, /normalized_query: matchingQuery\?\.toLowerCase/);
  assert.match(client, /setSaveSearchStatus\("details"\)/);
  assert.match(client, /query: searchQuery\.trim\(\) \|\| null/);
  assert.doesNotMatch(client, /query: demandDetails\.trim\(\) \|\| searchQuery/);
  assert.match(client, /Describe qué material necesitas para poder guardar el aviso/);
});

test("saved radius is limited, persists without storing another user's postcode and appears when reopened", () => {
  assert.match(migration, /add column if not exists radius_km integer/);
  assert.match(migration, /radius_km between 1 and 200/);
  assert.doesNotMatch(migration, /update public\.saved_searches|insert into public\.saved_searches/i);
  assert.match(route, /radius_km: radiusKm/);
  assert.match(route, /invalid_radius/);
  assert.match(route, /postal_code_required/);
  assert.match(route, /hasKnownPostalCode\(profile\?\.postal_code\)/);
  assert.match(route, /body\.onlyMyCommunity \|\| rawRadius === null/);
  assert.match(accountPage, /radius_km, need_details/);
  assert.match(account, /params\.set\("radiusKm", String\(search\.radius_km\)\)/);
  assert.match(client, /params\.get\("radiusKm"\)/);
  assert.match(client, /setDistanceKm\(Number\(fromRadius\)\)/);
});

test("notification matching uses server-only current postal centroids and no unbounded per-search queries", () => {
  assert.match(matchRoute, /approximateDistanceKm/);
  assert.match(matchRoute, /radius_km, demand_request_id/);
  assert.match(matchRoute, /const radiusCandidates/);
  assert.match(matchRoute, /candidateUserIds\.slice\(start, start \+ 150\)/);
  assert.match(matchRoute, /listing\.postal_code \|\| null/);
  assert.match(matchRoute, /viewerPostcodes\.get\(search\.user_id\)/);
  assert.match(matchRoute, /savedSearchMatchesListing\(/);
  assert.doesNotMatch(matchRoute, /postal_code:\s*viewerPostcodes/);
});
