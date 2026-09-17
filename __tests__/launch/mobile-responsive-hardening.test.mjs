import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("mobile navbar stays inside the header instead of using a portal or body scroll lock", () => {
  const navbar = read("components/navbar.tsx");
  assert.match(navbar, /id="mobile-navigation"/);
  assert.match(navbar, /absolute right-0 top-full/);
  assert.match(navbar, /max-h-\[calc\(100dvh-4rem\)\]/);
  assert.doesNotMatch(navbar, /createPortal/);
  assert.doesNotMatch(navbar, /document\.body\.style\.overflow/);
  assert.doesNotMatch(navbar, /fixed inset-0 z-\[100\]/);
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

test("mobile document width is hard-limited without drawer-specific overflow hacks", () => {
  const globals = read("app/globals.css");
  assert.match(globals, /html,\s*\n\s*body \{[\s\S]*max-width: 100%/);
  assert.match(globals, /overflow-x: hidden/);
  assert.doesNotMatch(globals, /overflow-y: auto !important/);
  assert.doesNotMatch(globals, /button\[aria-label='Cerrar menú'\]/);
});

test("cards and recharts widgets can shrink inside an iPhone viewport", () => {
  const cards = read("components/ui/card.tsx");
  const globals = read("app/globals.css");
  assert.match(cards, /flex min-w-0 flex-col/);
  assert.match(cards, /grid min-w-0 auto-rows-min/);
  assert.match(cards, /min-w-0 px-6/);
  assert.match(globals, /\[data-slot='chart'\] \{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;[\s\S]*overflow: hidden;/);
  assert.match(globals, /recharts-responsive-container/);
  assert.match(globals, /recharts-legend-wrapper > div/);
  assert.match(globals, /flex-wrap: wrap/);
});
