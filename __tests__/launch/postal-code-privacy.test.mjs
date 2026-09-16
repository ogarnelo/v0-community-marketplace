import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const helper = readFileSync("lib/location/postal-code.ts", "utf8");
const marketplace = readFileSync("components/marketplace/marketplace-client.tsx", "utf8");

test("postal code helpers keep location approximate", () => {
  assert.match(helper, /maskPostalCode/);
  assert.match(helper, /Zona aproximada/);
  assert.match(helper, /No mostramos tu dirección exacta/);
  assert.doesNotMatch(helper, /address|street|calle|número/i);
});

test("marketplace keeps postal code distance free and approximate", () => {
  assert.match(marketplace, /postalCode/);
  assert.match(marketplace, /Distancia máxima/);
  assert.doesNotMatch(marketplace, /mapbox|google maps|places|autocomplete/i);
});
