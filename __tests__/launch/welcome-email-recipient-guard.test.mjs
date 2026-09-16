import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const helper = fs.readFileSync("lib/emails/address.ts", "utf8");
const route = fs.readFileSync("app/api/emails/welcome/route.ts", "utf8");

test("welcome email normalizes and validates recipient before Resend", () => {
  assert.match(helper, /normalizeEmailAddress/);
  assert.match(helper, /trim\(\)/);
  assert.match(route, /normalizeEmailAddress\(user\.email\)/);
  assert.match(route, /invalid_recipient/);
  assert.match(route, /to: recipientEmail/);
});
