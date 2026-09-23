import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sendForm = fs.readFileSync("components/messages/send-message-form.tsx", "utf8");
const sendRoute = fs.readFileSync("app/api/messages/send/route.ts", "utf8");
const proposeRoute = fs.readFileSync("app/api/agreements/propose/route.ts", "utf8");
const confirmRoute = fs.readFileSync("app/api/agreements/confirm/route.ts", "utf8");

test("message hook notifies every recipient and keeps first-message email idempotent", () => {
  assert.match(sendForm, /\/api\/messages\/send/);
  assert.match(sendRoute, /kind: "message_received"/);
  assert.match(sendRoute, /contains\("metadata", \{ message_id: message\.id \}\)/);
  assert.match(sendRoute, /sendFirstMessageEmail/);
  assert.match(sendRoute, /firstMessage\?\.id === message\.id/);
  assert.match(sendRoute, /first-message\/\$\{message\.id\}/);
});

test("agreement routes wire proposal and final confirmation emails", () => {
  assert.match(proposeRoute, /sendAgreementProposedEmail/);
  assert.match(confirmRoute, /sendAgreementConfirmedEmail/);
  assert.match(confirmRoute, /if \(isConfirmed\)/);
});

test("email failures do not roll back marketplace actions", () => {
  assert.match(sendRoute, /catch \(emailError\)/);
  assert.match(proposeRoute, /catch \(emailError\)/);
  assert.match(confirmRoute, /catch \(emailError\)/);
});
