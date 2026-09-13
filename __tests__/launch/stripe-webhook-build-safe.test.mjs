import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Stripe webhook is lazy-configured and does not require env vars at build time", () => {
  const file = "app/api/stripe/webhook/route.ts";
  assert.ok(fs.existsSync(file), "stripe webhook route should exist");
  const source = fs.readFileSync(file, "utf8");

  assert.match(source, /function\s+getStripe/, "Stripe client should be created lazily");
  assert.match(source, /process\.env\.STRIPE_SECRET_KEY/, "Route should read STRIPE_SECRET_KEY inside runtime code");
  assert.doesNotMatch(
    source,
    /const\s+stripe\s*=\s*new\s+Stripe\s*\(/,
    "Route must not instantiate Stripe at module scope"
  );
  assert.match(source, /503/, "Route should fail safely when Stripe env vars are missing");
});
