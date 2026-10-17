import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
test("Spain-wide reuse guides have unique slugs and metadata without changing blog layout", () => {
  const content = read("lib/blog-data.ts");
  const page = read("app/blog/[slug]/page.tsx");
  const sitemap = read("app/sitemap.ts");
  for (const slug of [
    "donde-comprar-libros-texto-segunda-mano-espana",
    "organizar-intercambio-libros-colegio-familias-espana",
  ]) {
    assert.equal(content.split(`slug: "${slug}"`).length - 1, 1);
  }
  assert.match(content, /publishedAt: "2026-10-17"/);
  assert.match(content, /La entrega y el pago se acuerdan directamente entre las partes/);
  assert.match(page, /getPostBySlug/);
  assert.match(sitemap, /posts\.map/);
});
