import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const readiness = fs.readFileSync("scripts/mvp-readiness.mjs", "utf8");
const welcome = fs.readFileSync("app/api/emails/welcome/route.ts", "utf8");
const address = fs.readFileSync("lib/emails/address.ts", "utf8");

test("readiness script covers public MVP routes and copy", () => {
  for (const route of ["/marketplace", "/auth", "/help", "/privacy", "/terms"]) assert.match(readiness, new RegExp(route.replace("/", "\\/")));
  assert.match(readiness, /La entrega y el pago se acuerdan directamente entre las partes\./);
  assert.match(readiness, /Apple Pay/);
  assert.match(readiness, /Correos/);
});

test("welcome email rejects malformed recipients before Resend", () => {
  assert.match(address, /normalizeEmailAddress/);
  assert.match(address, /\^\[\^\\s@\]\+@/);
  assert.match(welcome, /normalizeEmailAddress\(user\.email\)/);
  assert.match(welcome, /invalid_recipient/);
});
