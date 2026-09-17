import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("mobile navbar uses a simple portal drawer instead of the Radix sheet", () => {
  const navbar = read("components/navbar.tsx");
  assert.match(navbar, /createPortal/);
  assert.match(navbar, /id="mobile-navigation"/);
  assert.doesNotMatch(navbar, /<Sheet open=/);
  assert.match(navbar, /className="shrink-0 md:hidden"/);
});

test("register school keeps the authenticated navbar and avoids a duplicate header", () => {
  const layout = read("app/register-school/layout.tsx");
  const page = read("app/register-school/page.tsx");
  assert.match(layout, /getNavbarData/);
  assert.match(layout, /isLoggedIn=\{navbarData\.isLoggedIn\}/);
  assert.doesNotMatch(page, /<Navbar/);
});

test("mobile listing CTA is compact and the marketplace FAB no longer overlays cards", () => {
  const actions = read("components/marketplace/mobile-listing-actions.tsx");
  const contact = read("components/messages/contact-seller-button.tsx");
  const globals = read("app/globals.css");
  assert.match(actions, /flex max-w-md items-center gap-3/);
  assert.doesNotMatch(actions, /Acuerdo local/);
  assert.match(contact, /hidden w-full md:inline-flex/);
  assert.match(globals, /a\[href='\/marketplace\/new'\]\.fixed/);
  assert.match(globals, /display: none !important/);
});

test("account and public profile use compact mobile grids", () => {
  const account = read("app/account/page.tsx");
  const profile = read("app/profile/[id]/page.tsx");
  assert.match(account, /grid grid-cols-2 gap-2\.5/);
  assert.match(account, /Acuerdos vendedor/);
  assert.match(profile, /grid grid-cols-3 gap-2/);
  assert.match(profile, /px-3 py-4 sm:px-4 sm:py-8/);
});

test("mobile document width stays stable after opening and closing the drawer", () => {
  const globals = read("app/globals.css");
  assert.match(globals, /html,\s*\n\s*body \{[\s\S]*max-width: 100%/);
  assert.match(globals, /overflow-x: hidden/);
  assert.match(globals, /overflow-y: auto !important/);
  assert.match(globals, /button\[aria-label='Cerrar menú'\]/);
  assert.match(globals, /touch-action: none/);
  assert.match(globals, /#mobile-navigation/);
  assert.match(globals, /overscroll-behavior: contain/);
});
