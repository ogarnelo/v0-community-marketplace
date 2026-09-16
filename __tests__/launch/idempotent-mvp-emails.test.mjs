import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const events = fs.readFileSync("lib/emails/mvp-event-emails.ts", "utf8");
const savedSearchEmail = fs.readFileSync("lib/emails/saved-search-match-email.ts", "utf8");
const messageForm = fs.readFileSync("components/messages/send-message-form.tsx", "utf8");
const messageRoute = fs.readFileSync("app/api/messages/send/route.ts", "utf8");
const proposeRoute = fs.readFileSync("app/api/agreements/propose/route.ts", "utf8");
const confirmRoute = fs.readFileSync("app/api/agreements/confirm/route.ts", "utf8");
const matchRoute = fs.readFileSync("app/api/marketplace/listings/match-saved-searches/route.ts", "utf8");

test("transactional email helpers support provider idempotency keys", () => {
  assert.match(events, /Idempotency-Key/);
  assert.match(savedSearchEmail, /Idempotency-Key/);
});

test("first-message hook binds delivery to the exact inserted message", () => {
  assert.match(messageForm, /messageId: insertedMessage\.id/);
  assert.match(messageRoute, /const messageId/);
  assert.match(messageRoute, /firstMessage\.id !== message\.id/);
  assert.match(messageRoute, /first-message\/\$\{message\.id\}/);
});

test("agreement and saved-search emails use stable event identities", () => {
  assert.match(proposeRoute, /agreement-proposed\/\$\{agreement\.id\}/);
  assert.match(confirmRoute, /agreement-confirmed\/\$\{agreement\.id\}\/\$\{recipient\.id\}/);
  assert.match(matchRoute, /saved-search-match\/\$\{match\.id\}/);
});

test("MVP delivery copy remains unchanged", () => {
  assert.match(events, /La entrega y el pago se acuerdan directamente entre las partes\./);
  assert.match(savedSearchEmail, /La entrega y el pago se acuerdan directamente entre las partes\./);
  assert.doesNotMatch(events, /Apple Pay|Correos|wallet|checkout/i);
  assert.doesNotMatch(savedSearchEmail, /Apple Pay|Correos|wallet|checkout/i);
});
