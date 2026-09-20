import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("next.config.mjs", "utf8");

test("global security headers are enabled without locking future payment integrations", () => {
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /nosniff/);
  assert.match(config, /X-Frame-Options/);
  assert.match(config, /DENY/);
  assert.match(config, /Referrer-Policy/);
  assert.match(config, /strict-origin-when-cross-origin/);
  assert.doesNotMatch(config, /Content-Security-Policy/);
});
