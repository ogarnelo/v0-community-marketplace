import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/account/saved-searches/page.tsx", "utf8");

test("saved-search account loads matched listings", () => {
  assert.match(page, /saved_search_matches/);
  assert.match(page, /listing_id/);
  assert.match(page, /saved_search_id/);
  assert.match(page, /matched_at/);
});

test("saved-search account shows only available matched listings", () => {
  assert.match(page, /match\.listing\?\.status === "available"/);
  assert.match(page, /Novedades para tus búsquedas/);
  assert.match(page, /Ver anuncio/);
});
