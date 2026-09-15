import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publishForm = readFileSync("components/marketplace/new-listing-form.tsx", "utf8");
const marketplaceClient = readFileSync("components/marketplace/marketplace-client.tsx", "utf8");
const mockData = readFileSync("lib/mock-data.ts", "utf8");

test("publish form is mobile-first and organized by scrollable blocks", () => {
  assert.match(publishForm, /Sube tu anuncio/);
  assert.match(publishForm, /Fotos/);
  assert.match(publishForm, /Información básica/);
  assert.match(publishForm, /Categoría y detalles/);
  assert.match(publishForm, /Precio o donación/);
  assert.match(publishForm, /fixed inset-x-0 bottom-0/);
  assert.match(publishForm, /sm:static/);
});

test("publish flow keeps current MVP scope without exchange, checkout or maps", () => {
  assert.doesNotMatch(publishForm, /Intercambio/);
  assert.doesNotMatch(publishForm, /checkout|carrito|Apple Pay|Correos|DHL/i);
  assert.doesNotMatch(publishForm, /mapbox|leaflet|google maps|places/i);
  assert.match(publishForm, /Venta/);
  assert.match(publishForm, /Donación/);
  assert.match(publishForm, /La entrega y el pago se acuerdan directamente entre las partes/);
});

test("category details adapt to educational product types", () => {
  assert.match(publishForm, /Detalles recomendados para/);
  assert.match(publishForm, /ISBN/);
  assert.match(publishForm, /Asignatura/);
  assert.match(publishForm, /Editorial/);
  assert.match(publishForm, /Prenda/);
  assert.match(publishForm, /Talla/);
  assert.match(publishForm, /Marca/);
  assert.match(publishForm, /Modelo/);
});

test("marketplace filters are responsive and no longer expose fake distance UI", () => {
  assert.match(marketplaceClient, /side="bottom"/);
  assert.match(marketplaceClient, /max-h-\[85dvh\]/);
  assert.match(marketplaceClient, /fixed bottom-4 right-4/);
  assert.doesNotMatch(marketplaceClient, /Ubicación y distancia/);
  assert.doesNotMatch(marketplaceClient, /Preparado para cuando los anuncios tengan coordenadas/);
  assert.doesNotMatch(marketplaceClient, /Slider/);
});

test("educational categories cover the vertical without videogames or generic logistics", () => {
  for (const label of [
    "Libros de texto",
    "Lectura y literatura",
    "Material escolar",
    "Uniformes",
    "Tecnología y calculadoras",
    "Mochilas y estuches",
    "Música",
    "Deporte escolar",
    "Material universitario",
  ]) {
    assert.match(mockData, new RegExp(label));
  }

  assert.doesNotMatch(mockData, /Videojuegos/);
});
