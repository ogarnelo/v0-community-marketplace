import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const footer = readFileSync("components/footer.tsx", "utf8");

test("public SEO landings are discoverable from the site footer", () => {
  for (const href of ["/como-funciona", "/vende-tus-libros", "/blog"]) {
    assert.ok(footer.includes(`href="${href}"`));
  }
});

test("public SEO landings use the same global shell as the rest of Wetudy", () => {
  for (const path of [
    "app/como-funciona/page.tsx",
    "app/vende-tus-libros/page.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /getNavbarData/);
    assert.match(source, /<Navbar \{\.\.\.navbarData\} \/>/);
    assert.match(source, /<Footer \/>/);
  }
});

test("legacy ranking and impacto stay as redirects instead of stale standalone pages", () => {
  for (const path of ["app/ranking/page.tsx", "app/impacto/page.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /permanentRedirect\("\/about"\)/);
  }
});
