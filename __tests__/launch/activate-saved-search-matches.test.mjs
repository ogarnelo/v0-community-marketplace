import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const form = fs.readFileSync("components/marketplace/new-listing-form.tsx", "utf8");
const route = fs.readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260916074500_saved_search_matches.sql", "utf8");

test("listing publication triggers saved-search matching", () => {
  assert.match(form, /\/api\/marketplace\/listings\/match-saved-searches/);
  assert.match(route, /savedSearchMatchesListing/);
  assert.match(route, /notifications_enabled/);
});

test("matching hook verifies ownership and avoids self alerts", () => {
  assert.match(route, /listing\.seller_id !== user\.id/);
  assert.match(route, /\.neq\("user_id", user\.id\)/);
});

test("saved-search matches are idempotent", () => {
  assert.match(migration, /unique\(saved_search_id, listing_id\)/);
  assert.match(route, /onConflict: "saved_search_id,listing_id"/);
  assert.match(route, /ignoreDuplicates: true/);
});
