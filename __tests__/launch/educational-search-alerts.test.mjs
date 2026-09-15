import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260915203000_saved_searches.sql", "utf8");
const route = readFileSync("app/api/marketplace/saved-searches/route.ts", "utf8");
const docs = readFileSync("docs/EDUCATIONAL_SEARCH_ALERTS_V1.md", "utf8");

test("saved searches persist educational demand signals", () => {
  assert.match(migration, /create table if not exists public\.saved_searches/);
  assert.match(migration, /isbn_query text/);
  assert.match(migration, /grade_level text/);
  assert.match(migration, /results_count integer/);
  assert.match(migration, /saved_search_demand_summary/);
});

test("saved search RLS keeps user searches private and admin-readable", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /public\.is_superadmin\(\)/);
});

test("saved search API requires auth and intent", () => {
  assert.match(route, /auth_required/);
  assert.match(route, /search_intent_required/);
  assert.match(route, /query/);
  assert.match(route, /isbnQuery/);
  assert.match(route, /gradeLevel/);
});

test("search alerts stay in MVP scope", () => {
  assert.match(docs, /Avísame si aparece/);
  assert.match(docs, /No Stripe, Correos, checkout or buyer protection/);
  assert.doesNotMatch(route, /stripe|correos|dhl|checkout|apple pay/i);
});
