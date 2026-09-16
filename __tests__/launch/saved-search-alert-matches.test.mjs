import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = readFileSync("supabase/migrations/20260916074500_saved_search_matches.sql", "utf8");
const matcher = readFileSync("lib/marketplace/saved-search-matching.ts", "utf8");
const docs = readFileSync("docs/SAVED_SEARCH_ALERT_MATCHES_V1.md", "utf8");

test("saved search matches are deduped per search and listing", () => {
  assert.match(migration, /saved_search_matches/);
  assert.match(migration, /unique\(saved_search_id, listing_id\)/);
  assert.match(migration, /emailed_at/);
});

test("saved search matcher covers educational intent fields", () => {
  assert.match(matcher, /isbn_query/);
  assert.match(matcher, /grade_level/);
  assert.match(matcher, /only_my_community/);
  assert.match(matcher, /category/);
});

test("saved search matching avoids inflated promises", () => {
  assert.match(docs, /No promise of perfect matching/);
  assert.doesNotMatch(docs, /checkout|Correos|Apple Pay/i);
});
