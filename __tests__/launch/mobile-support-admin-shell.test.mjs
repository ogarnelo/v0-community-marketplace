import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("home benefits are centered on narrow mobile screens", () => {
  const hero = read("components/landing/hero-section.tsx");
  assert.match(hero, /justify-items-center/);
  assert.match(hero, /w-fit grid-cols-\[2\.5rem_1fr\]/);
  assert.match(hero, /sm:justify-items-stretch/);
});

test("school admin navigation falls back to mobile menu on crowded tablet widths", () => {
  const navbar = read("components/navbar.tsx");
  assert.match(navbar, /schoolAdminNavigation/);
  assert.match(navbar, /min-\[1180px\]:flex/);
  assert.match(navbar, /min-\[1180px\]:hidden/);

  const messagesIndex = navbar.indexOf('{ href: "/messages", label: "Mensajes"');
  const schoolCodeIndex = navbar.indexOf('label: "Código de colegio"');
  assert.ok(messagesIndex >= 0 && schoolCodeIndex > messagesIndex);
});

test("help support can be contacted without an account while retaining abuse controls", () => {
  const form = read("components/help/help-contact-form.tsx");
  const route = read("app/api/support/tickets/route.ts");

  assert.doesNotMatch(form, /Inicia sesión para contactar con soporte/);
  assert.match(form, /Puedes escribirnos aunque todavía no tengas una cuenta/);
  assert.match(form, /name: normalizedName/);
  assert.match(form, /email: normalizedEmail/);
  assert.match(form, /website/);

  assert.doesNotMatch(route, /Debes iniciar sesión para contactar con soporte/);
  assert.match(route, /user_id: user\?\.id \|\| null/);
  assert.match(route, /\.eq\("email", email\)/);
  assert.match(route, /if \(website\)/);
});

test("super admin users and schools keep the global site shell", () => {
  for (const path of [
    "app/admin/super/users/page.tsx",
    "app/admin/super/schools/page.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /getNavbarData/);
    assert.match(source, /<Navbar \{\.\.\.navbarData\} \/>/);
    assert.match(source, /<Footer \/>/);
  }
});
