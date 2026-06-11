import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const exists = (file) => fs.existsSync(path.join(root, file));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("critical launch files exist", () => {
  const required = [
    "app/api/stripe/webhook/route.ts",
    "app/api/payments/create-intent/route.ts",
    "app/api/offers/create/route.ts",
    "app/api/offers/respond/route.ts",
    "app/marketplace/page.tsx",
    "app/marketplace/listing/[id]/page.tsx",
    "app/messages/page.tsx",
    "app/messages/[id]/page.tsx",
    "app/checkout/[offerId]/page.tsx",
    "app/api/health/supabase-keepalive/route.ts",
    "app/api/health/full/route.ts",
  ];

  for (const file of required) {
    assert.equal(exists(file), true, `${file} should exist`);
  }
});

test("duplicated legacy files stay removed", () => {
  const obsolete = [
    "lib/marketplace-formatters.ts",
    "lib/mock-data.ts",
    "components/marketplace/listing-view-tracker.tsx",
    "components/marketplace/post-publish-share.tsx",
    "components/marketplace/related-listings.tsx",
    "app/api/listings/saved-searches/create/route.ts",
    "app/api/listings/saved-searches/delete/route.ts",
  ];

  for (const file of obsolete) {
    assert.equal(exists(file), false, `${file} should have been removed by cleanup:duplicates`);
  }
});

test("canonical constants and saved-search APIs exist", () => {
  assert.equal(exists("lib/constants.ts"), true, "lib/constants.ts should exist");
  assert.equal(exists("app/api/saved-searches/create/route.ts"), true, "saved-search create API should exist");
  assert.equal(exists("app/api/saved-searches/delete/route.ts"), true, "saved-search delete API should exist");
});

test("navbar message badge exports are valid if module is used again", () => {
  const file = "components/messages/navbar-messages-badge.tsx";
  assert.equal(exists(file), true, `${file} should exist`);
  const source = read(file);
  assert.match(source, /export\s+function\s+NavbarMessagesBadge|export\s+\{\s*NavbarMessagesBadge\s*\}/, "NavbarMessagesBadge named export missing");
  assert.match(source, /export\s+default\s+NavbarMessagesBadge|export\s+default\s+function/, "NavbarMessagesBadge default export missing");
});

test("critical routes have loading and error fallbacks", () => {
  const fallbacks = [
    "app/marketplace/loading.tsx",
    "app/account/loading.tsx",
    "app/messages/loading.tsx",
    "app/checkout/[offerId]/loading.tsx",
    "app/messages/[id]/loading.tsx",
    "app/checkout/[offerId]/error.tsx",
    "app/messages/[id]/error.tsx",
    "app/error.tsx",
  ];

  for (const file of fallbacks) {
    assert.equal(exists(file), true, `${file} should exist`);
  }
});
