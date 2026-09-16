import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sendForm = fs.readFileSync("components/messages/send-message-form.tsx", "utf8");
const sendRoute = fs.readFileSync("app/api/messages/send/route.ts", "utf8");
const proposeRoute = fs.readFileSync("app/api/agreements/propose/route.ts", "utf8");
const confirmRoute = fs.readFileSync("app/api/agreements/confirm/route.ts", "utf8");

test("first-message hook is wired and idempotent", () => {
  assert.match(sendForm, /\/api\/messages\/send/);
  assert.match(sendRoute, /sendFirstMessageEmail/);
  assert.match(sendRoute, /senderMessageCount/);
  assert.match(sendRoute, /!== 1/);
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
