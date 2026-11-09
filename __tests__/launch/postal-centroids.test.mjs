import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/marketplace/postal-centroids.ts", "utf8");
const client = readFileSync("components/marketplace/marketplace-client.tsx", "utf8");

test("full Spanish postcodes are present, distinct and approximate", () => {
  const entries = [...source.matchAll(/"([0-9]{5})": \[(-?[0-9.]+), (-?[0-9.]+)\]/g)];
  const codes = new Set(entries.map((match) => match[1]));
  assert.ok(codes.size >= 10000, "Dataset should cover >10,000 Spanish postal codes");
  assert.equal(entries.length, codes.size, "Each postcode should occur once");
  for (const postal of ["01001", "04001", "08001", "28001", "35001", "41001", "46001"]) {
    assert.ok(codes.has(postal), "Missing representative postcode " + postal);
  }
  for (const [, , lat, lng] of entries) {
    assert.ok(Number(lat) >= 27 && Number(lat) <= 44);
    assert.ok(Number(lng) >= -19 && Number(lng) <= 5);
  }
});
test("distance uses complete postcode, not province prefix or private address", () => {
  assert.match(client, /POSTAL_CENTROIDS\[normalized\]/);
  assert.doesNotMatch(client, /POSTAL_PREFIX_COORDS/);
  assert.match(client, /Estimación entre centros de códigos postales/);
  assert.match(client, /No mostramos direcciones/);
});
