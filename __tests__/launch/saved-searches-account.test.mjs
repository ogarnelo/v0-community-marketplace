import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const page = readFileSync("app/account/saved-searches/page.tsx", "utf8");
const component = readFileSync("components/account/saved-searches-list.tsx", "utf8");

test("account exposes saved searches page", () => {
  assert.match(page, /Mis búsquedas/);
  assert.match(page, /saved_searches/);
  assert.match(page, /Buscar material/);
});

test("saved searches can be reopened, toggled and deleted", () => {
  assert.match(component, /Reabrir/);
  assert.match(component, /notifications_enabled/);
  assert.match(component, /\.delete\(\)/);
  assert.match(component, /Switch/);
});

test("saved searches stay MVP scoped", () => {
  assert.match(component, /Los avisos todavía no envían emails automáticos/);
  assert.doesNotMatch(page + component, /checkout|Correos|Apple Pay|intercambio/i);
});
