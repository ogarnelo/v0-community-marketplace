import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const marketplaceClient = readFileSync("components/marketplace/marketplace-client.tsx", "utf8");
const savedSearchRoute = readFileSync("app/api/marketplace/saved-searches/route.ts", "utf8");
const docs = readFileSync("docs/SAVED_SEARCH_UI_V1.md", "utf8");

test("empty marketplace state exposes saved search demand CTA", () => {
  assert.match(marketplaceClient, /Avísame si aparece/);
  assert.match(marketplaceClient, /\/api\/marketplace\/saved-searches/);
  assert.match(marketplaceClient, /hasSearchIntent/);
  assert.match(marketplaceClient, /Búsqueda guardada/);
  assert.match(marketplaceClient, /No enviaremos emails hasta activar las notificaciones/);
});

test("saved search UI keeps MVP scope", () => {
  assert.doesNotMatch(marketplaceClient, /checkout|Apple Pay|Correos|DHL|intercambio/i);
  assert.match(savedSearchRoute, /auth_required/);
  assert.match(savedSearchRoute, /notifications_enabled: true/);
  assert.match(docs, /No emails or push notifications are sent yet/);
});
