import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const mustExist = [
  "app/marketplace/page.tsx",
  "app/marketplace/listing/[id]/page.tsx",
  "app/checkout/[offerId]/page.tsx",
  "app/messages/[id]/page.tsx",
  "components/navbar.tsx",
  "components/navigation/mobile-bottom-navigation.tsx",
  "components/messages/navbar-messages-badge.tsx",
  "app/api/stripe/webhook/route.ts",
  "app/api/offers/create/route.ts",
  "app/api/payments/create-intent/route.ts",
];

test("critical files exist", () => {
  for (const file of mustExist) {
    assert.equal(existsSync(join(root, file)), true, `${file} should exist`);
  }
});

test("critical source files do not contain placeholder markers", () => {
  for (const file of mustExist) {
    const content = readFileSync(join(root, file), "utf8");
    assert.equal(content.includes("REPLACE_"), false, `${file} contains REPLACE_ placeholder`);
  }
});

test("NavbarMessagesBadge exports a component", () => {
  const content = readFileSync(join(root, "components/messages/navbar-messages-badge.tsx"), "utf8");
  assert.match(content, /export\s+function\s+NavbarMessagesBadge|export\s+default\s+function\s+NavbarMessagesBadge|export\s+default\s+NavbarMessagesBadge/);
});
