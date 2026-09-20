import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("lib/services/payments.service.ts", "utf8");
const review = readFileSync("app/api/reviews/create/route.ts", "utf8");
const deletion = readFileSync("app/api/listings/delete/route.ts", "utf8");
const offerCard = readFileSync("components/messages/conversation-offer-card.tsx", "utf8");

test("internal payment states match the payment_intents schema", () => {
  assert.doesNotMatch(service, /requires_shipping_quote/);
  assert.match(service, /const paymentStatus = "requires_payment_method"/);

  assert.doesNotMatch(review, /payment\.status !== "paid"/);
  assert.match(review, /payment\.status !== "succeeded"/);

  assert.doesNotMatch(deletion, /requires_action|"paid"/);
  assert.match(deletion, /"requires_capture"/);
  assert.match(deletion, /"succeeded"/);
});

test("offer UI uses succeeded for the internal payment status", () => {
  assert.doesNotMatch(offerCard, /paymentStatus === "paid"/);
  assert.doesNotMatch(offerCard, /paymentStatus !== "paid"/);
  assert.match(offerCard, /paymentStatus === "succeeded"/);
  assert.match(offerCard, /\["succeeded", "processing", "requires_capture"\]/);
});
