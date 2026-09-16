import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const marketplace = readFileSync("components/marketplace/marketplace-client.tsx", "utf8");

test("marketplace restores slider price filtering", () => {
  assert.match(marketplace, /<Slider[\s\S]*value=\{priceRange\}/);
  assert.match(marketplace, /minStepsBetweenThumbs/);
  assert.doesNotMatch(marketplace, /PRICE_PRESETS/);
  assert.doesNotMatch(marketplace, /0-25 €/);
});

test("marketplace offers distance only outside community mode", () => {
  assert.match(marketplace, /!onlyMyCommunity \? \(/);
  assert.match(marketplace, /Distancia máxima/);
  assert.match(marketplace, /DISTANCE_STEPS = \[1, 5, 10, 30, 50, 100, 200, 201\]/);
  assert.match(marketplace, /\+200 km/);
});

test("marketplace adds publication date checkboxes", () => {
  assert.match(marketplace, /Fecha de publicación/);
  assert.match(marketplace, /Hoy/);
  assert.match(marketplace, /Últimos 7 días/);
  assert.match(marketplace, /Últimos 30 días/);
  assert.match(marketplace, /<Checkbox/);
});

test("saved search UI stays MVP scoped", () => {
  assert.match(marketplace, /Avísame si aparece/);
  assert.match(marketplace, /No enviaremos emails hasta activar las notificaciones/);
  assert.doesNotMatch(marketplace, /checkout|Correos|Apple Pay|intercambio/i);
});
