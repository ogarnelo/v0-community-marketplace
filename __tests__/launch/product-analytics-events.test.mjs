import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

const serverHelper = read("lib/analytics/product-events.server.ts");
const authCallback = read("app/auth/callback/route.ts");
const studentsRoute = read("app/api/account/students/route.ts");
const courseNeedsRoute = read("app/api/my-course/needs/route.ts");
const agreementRoute = read("app/api/agreements/confirm/route.ts");
const conversationsService = read("lib/services/conversations.service.ts");
const buyNowRoute = read("app/api/offers/buy-now/route.ts");
const listingForm = read("components/marketplace/new-listing-form.tsx");
const joinSchool = read("app/onboarding/join-school/page.tsx");
const contactSeller = read("components/messages/contact-seller-button.tsx");

test("server product analytics runs after the response and filters identifier fields", () => {
  assert.match(serverHelper, /import \{ after \} from "next\/server"/);
  assert.match(serverHelper, /@vercel\/analytics\/server/);
  assert.match(serverHelper, /after\(async \(\) =>/);
  assert.match(serverHelper, /user_id/);
  assert.match(serverHelper, /student_id/);
  assert.match(serverHelper, /school_id/);
  assert.match(serverHelper, /listing_id/);
  assert.match(serverHelper, /conversation_id/);
  assert.match(serverHelper, /agreement_id/);
});

test("the six pilot funnel events are wired to successful actions", () => {
  assert.match(authCallback, /deferProductEvent\("signup_completed"/);
  assert.match(studentsRoute, /deferProductEvent\("school_linked"/);
  assert.match(joinSchool, /track\("school_linked"/);
  assert.match(listingForm, /track\("listing_created"/);
  assert.match(courseNeedsRoute, /deferProductEvent\("course_need_created"/);
  assert.match(conversationsService, /deferProductEvent\("conversation_started"/);
  assert.match(buyNowRoute, /deferProductEvent\("conversation_started"/);
  assert.match(contactSeller, /track\("conversation_started"/);
  assert.match(agreementRoute, /deferProductEvent\("agreement_confirmed"/);
});

test("external analytics payloads keep only coarse product context", () => {
  assert.match(listingForm, /listing_type: isDonation \? "donation" : "sale"/);
  assert.match(listingForm, /source: activationOpportunityKey \? "demand_opportunity" : "direct"/);
  assert.match(joinSchool, /link_type: "profile"/);
  assert.match(studentsRoute, /link_type: "student_context"/);
  assert.match(courseNeedsRoute, /source: "mi_curso"/);
  assert.match(agreementRoute, /source: "chat_agreement"/);
  assert.match(contactSeller, /source: "contact_seller"/);
  assert.match(buyNowRoute, /source: "buy_now"/);
});
