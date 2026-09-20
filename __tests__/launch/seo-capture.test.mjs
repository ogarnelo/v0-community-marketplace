import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sellBooks = readFileSync("app/vende-tus-libros/page.tsx", "utf8");
const howItWorks = readFileSync("app/como-funciona/page.tsx", "utf8");
const sitemap = readFileSync("app/sitemap.ts", "utf8");
const docs = readFileSync("docs/SEO_CAPTURE_V1.md", "utf8");

test("SEO pages target educational acquisition", () => {
  assert.match(sellBooks, /Vende o dona los libros del curso pasado/);
  assert.match(sellBooks, /ISBN/);
  assert.match(sellBooks, /editorial/i);
  assert.match(howItWorks, /Cómo funciona/);
  assert.match(howItWorks, /La entrega y el pago se acuerdan directamente entre las partes/);
});

test("SEO capture stays out of disallowed scope", () => {
  assert.match(docs, /No checkout/);
  assert.match(docs, /No uniform-specific vertical page/);
  assert.doesNotMatch(sellBooks + howItWorks, /Stripe|Correos|DHL|Apple Pay|intercambio/i);
});

test("sitemap stays fresh and only includes available listings", () => {
  assert.match(sitemap, /export const revalidate = 0/);
  assert.match(sitemap, /2026-09-20T00:00:00\.000Z/);
  assert.match(sitemap, /\.eq\("status", "available"\)/);
});
