import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accountPage = readFileSync("app/account/page.tsx", "utf8");
const docs = readFileSync("docs/MOBILE_ACCOUNT_V1.md", "utf8");

test("account page exposes app-like mobile actions", () => {
  for (const label of ["Publicar", "Mis anuncios", "Mensajes", "Favoritos", "Mis acuerdos", "Soporte"]) {
    assert.match(accountPage, new RegExp(label));
  }
  assert.match(accountPage, /Actividad reciente/);
  assert.doesNotMatch(accountPage, /Actividad MVP/);

  assert.match(accountPage, /grid-cols-2/);
  assert.match(accountPage, /lg:grid-cols-6/);
});

test("account page remains MVP and avoids checkout vocabulary", () => {
  assert.doesNotMatch(accountPage, /Mis compras|Pedidos|Monedero|checkout|env[ií]os integrados/i);
  assert.match(docs, /no checkout/i);
  assert.match(docs, /no wallet/i);
});
