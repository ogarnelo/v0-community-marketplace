import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("three additional national educational reuse guides remain distinct", () => {
  const data = readFileSync("lib/blog-data.ts", "utf8");
  const expected = [
    "donde-donar-libros-texto-usados-espana",
    "banco-libros-escolar-como-funciona-espana",
    "ayudas-libros-texto-material-escolar-espana",
  ];
  for (const slug of expected) {
    assert.equal(data.split(`slug: "${slug}"`).length - 1, 1);
  }
  assert.match(data, /En España/);
  assert.match(data, /no significa que todas las familias puedan solicitar una ayuda estatal directamente/);
  assert.match(data, /consulta siempre su información vigente/);
  assert.match(readFileSync("app/sitemap.ts", "utf8"), /posts\.map/);
  assert.match(readFileSync("app/blog/[slug]/page.tsx", "utf8"), /getPostBySlug/);
});
