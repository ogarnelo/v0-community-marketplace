import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts", "utf8");
const email = fs.readFileSync("lib/emails/saved-search-match-email.ts", "utf8");

test("pending saved-search matches are emailed", () => {
  assert.match(route, /sendSavedSearchMatchEmail/);
  assert.match(route, /getUserById\(match\.user_id\)/);
  assert.match(route, /\.is\("emailed_at", null\)/);
  assert.match(route, /\.in\("saved_search_id", matches\.map/);
});

test("emailed_at is marked only after the email call succeeds", () => {
  const sendIndex = route.indexOf("await sendSavedSearchMatchEmail");
  const markIndex = route.indexOf(".update({ emailed_at:");
  assert.ok(sendIndex >= 0);
  assert.ok(markIndex > sendIndex);
  assert.match(route, /if \("skipped" in result && result\.skipped\) continue/);
});

test("email copy stays inside the MVP scope", () => {
  assert.match(email, /Ha aparecido algo que buscabas/);
  assert.match(email, /La entrega y el pago se acuerdan directamente entre las partes\./);
  assert.doesNotMatch(email, /checkout|Apple Pay|Correos|wallet/i);
});
