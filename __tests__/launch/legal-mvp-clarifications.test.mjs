import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const terms = readFileSync("app/terms/page.tsx", "utf8");

test("MVP legal terms exclude professional selling and explain ranking", () => {
  assert.match(terms, /No se permite utilizar el servicio como\s+canal habitual de venta/);
  assert.match(terms, /muestra primero los anuncios más recientes/);
  assert.match(terms, /no ofrece actualmente posiciones de pago/);
});

test("DSA contact and minor-friendly summary are public", () => {
  assert.match(terms, /Punto de contacto/);
  assert.match(terms, /hola@wetudy\.com/);
  assert.match(terms, /Resumen para estudiantes menores/);
});
