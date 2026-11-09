import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const marketplace = readFileSync("components/marketplace/marketplace-client.tsx", "utf8");
const page = readFileSync("app/marketplace/page.tsx", "utf8");
const types = readFileSync("lib/types/marketplace.ts", "utf8");

test("marketplace restores slider price filtering", () => {
  assert.match(marketplace, /<Slider[\s\S]*value=\{priceRange\}/);
  assert.match(marketplace, /minStepsBetweenThumbs/);
  assert.doesNotMatch(marketplace, /PRICE_PRESETS/);
  assert.doesNotMatch(marketplace, /0-25 €/);
});

test("marketplace calculates approximate distance from postal codes", () => {
  assert.match(page, /profiles[\s\S]*postal_code/);
  assert.match(page, /listings[\s\S]*postal_code/);
  assert.match(types, /postalCode\?: string \| null/);
  assert.match(marketplace, /calculateDistanceKm\(viewerPostalCode, listing\.postalCode\)/);
  assert.match(marketplace, /Estimación basada en centros provinciales/);
  assert.match(marketplace, /No mostramos direcciones/);
});

test("marketplace offers distance only outside community mode", () => {
  assert.match(marketplace, /Distancia aproximada/);
  assert.match(marketplace, /Slider min=\{1\}/);
  assert.match(marketplace, /distanceKm/);
  assert.match(marketplace, /calculateDistanceKm/);
  assert.match(marketplace, /POSTAL_PREFIX_COORDS/);
  assert.match(marketplace, /selectedDistanceLabel/);
  assert.match(marketplace, /DISTANCE_MAX = 201/);
  assert.match(marketplace, /\+200/);
  assert.match(marketplace, /\+200/);
  assert.match(marketplace, /disabled=\{onlyMyCommunity \|\| !hasViewerPostalCode\}/);
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
  assert.match(marketplace, /Búsqueda guardada\. Te avisaremos si aparece un anuncio compatible\./);
  assert.doesNotMatch(marketplace, /activar las notificaciones|No enviaremos emails/);
  assert.doesNotMatch(marketplace, /checkout|Correos|Apple Pay|intercambio/i);
});
