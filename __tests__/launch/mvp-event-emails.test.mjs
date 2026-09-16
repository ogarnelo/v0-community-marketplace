import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const emails = readFileSync("lib/emails/mvp-event-emails.ts", "utf8");
const docs = readFileSync("docs/MVP_EVENT_EMAILS_V1.md", "utf8");

test("event emails cover MVP lifecycle events", () => {
  assert.match(emails, /sendFirstMessageEmail/);
  assert.match(emails, /sendAgreementProposedEmail/);
  assert.match(emails, /sendAgreementConfirmedEmail/);
});

test("event emails keep chat and direct agreement copy", () => {
  assert.match(emails, /Responde en Wetudy para acordar los detalles por chat/);
  assert.match(emails, /La entrega y el pago se acuerdan directamente entre las partes/);
});

test("event emails stay away from checkout and shipping promises", () => {
  assert.doesNotMatch(emails, /Correos|Apple Pay|Stripe|checkout/i);
  assert.match(docs, /No checkout/);
});
