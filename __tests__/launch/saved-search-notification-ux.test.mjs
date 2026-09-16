import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/account/saved-searches/page.tsx", "utf8");
const matches = fs.readFileSync("components/account/saved-search-matches-list.tsx", "utf8");
const searches = fs.readFileSync("components/account/saved-searches-list.tsx", "utf8");

test("saved-search matches can be dismissed by their owner", () => {
  assert.match(page, /SavedSearchMatchesList/);
  assert.match(matches, /from\("saved_search_matches"\)\.delete\(\)\.eq\("id", id\)/);
  assert.match(matches, /Descartar coincidencia/);
});

test("saved-search notification copy reflects active email alerts", () => {
  assert.match(searches, /Aviso activo: te enviaremos un email cuando aparezca una coincidencia\./);
  assert.match(searches, /Aviso pausado: puedes reactivarlo cuando quieras\./);
  assert.doesNotMatch(searches, /todavía no envían emails automáticos/i);
});
