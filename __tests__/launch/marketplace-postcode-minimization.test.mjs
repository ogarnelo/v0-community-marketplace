import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = [
  "app/marketplace/page.tsx",
  "app/api/marketplace/feed/route.ts",
  "app/api/marketplace/my-school/route.ts",
];

test("marketplace card payloads never expose a seller's full postal code", () => {
  for (const path of files) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /postalCode: null, \/\//, path);
    assert.doesNotMatch(source,
      /postalCode:\s*(seller\?\.postalCode|currentSellerPostalCode|item\.postal_code)\s*[,}]/,
      path + " leaks the seller CP to serialized cards");
    assert.match(source, /approximateDistanceKm\(/, path);
  }
});

test("precise proximity stays internal and code-postal validation remains enforced", () => {
  const route = readFileSync("app/api/marketplace/feed/route.ts", "utf8");
  const page = readFileSync("app/marketplace/page.tsx", "utf8");
  assert.match(route, /hasKnownPostalCode\(viewerPostalCode\)/);
  assert.match(route, /nearbyDistances\.get\(item\.id\)/);
  assert.match(page, /initialHasKnownPostalCode=\{hasKnownPostalCode\(viewerPostalCode\)\}/);
  assert.match(route, /Cache-Control": "private, no-store"/);
});
