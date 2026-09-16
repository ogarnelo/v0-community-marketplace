import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const account = readFileSync("app/account/page.tsx", "utf8");
const docs = readFileSync("docs/ACCOUNT_NAVIGATION_CLEANUP_V1.md", "utf8");

test("account hub exposes saved searches", () => {
  assert.match(account, /\/account\/saved-searches/);
  assert.match(account, /Mis búsquedas/);
});

test("account hub keeps MVP navigation", () => {
  assert.match(account, /Mis anuncios/);
  assert.match(account, /Mensajes/);
  assert.match(account, /Favoritos/);
  assert.match(account, /Mis acuerdos/);
});

test("account navigation avoids commerce-only areas", () => {
  assert.doesNotMatch(docs, /wallet|shipping tracking/i);
  assert.match(docs, /No checkout/);
});
