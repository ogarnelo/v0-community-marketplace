import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260924143000_liquidity_attribution_v1.sql");
const helper = read("lib/demand/need-attribution.ts");
const savedSearchRoute = read("app/api/marketplace/saved-searches/route.ts");
const contactButton = read("components/messages/contact-seller-button.tsx");
const contactRoute = read("app/api/demand/attribute-contact/route.ts");
const matchRoute = read("app/api/marketplace/listings/match-saved-searches/route.ts");
const proposeRoute = read("app/api/agreements/propose/route.ts");
const confirmRoute = read("app/api/agreements/confirm/route.ts");

test("demand_requests becomes the stable need identity without a parallel table", () => {
  assert.match(migration, /saved_searches[\s\S]*demand_request_id/);
  assert.match(migration, /conversations[\s\S]*demand_request_id/);
  assert.match(migration, /agreements[\s\S]*demand_request_id/);
  assert.match(migration, /first_result_at/);
  assert.match(migration, /first_contact_at/);
  assert.match(migration, /first_agreement_at/);
  assert.match(migration, /resolved_at/);
  assert.doesNotMatch(migration, /create table[^;]*needs/i);
});

test("explicit zero-result saved searches create and link a stable need", () => {
  assert.match(savedSearchRoute, /from\("demand_requests"\)/);
  assert.match(savedSearchRoute, /source: "saved_search"/);
  assert.match(savedSearchRoute, /demand_request_id/);
  assert.match(migration, /Backfill existing explicit zero-result saved searches/);
});

test("contact attribution prefers explicit saved-search matches and refuses ambiguity", () => {
  assert.match(helper, /strongSavedSearchNeedIds/);
  assert.match(helper, /saved_search_matches/);
  assert.match(helper, /candidateIds\.length !== 1/);
  assert.match(helper, /reason: candidateIds\.length > 1 \? "ambiguous"/);
  assert.match(helper, /need\.school_id/);
  assert.match(helper, /need\.category/);
  assert.match(contactRoute, /attributeNeedToConversation/);
  assert.match(contactButton, /\/api\/demand\/attribute-contact/);
});

test("result, contact and agreement timestamps are recorded without forcing attribution", () => {
  assert.match(matchRoute, /recordNeedResult/);
  assert.match(helper, /first_result_at/);
  assert.match(helper, /first_contact_at/);
  assert.match(helper, /first_agreement_at/);
  assert.match(helper, /confirmed_agreement_id/);
  assert.match(proposeRoute, /linkAgreementToNeed/);
  assert.match(confirmRoute, /linkAgreementToNeed/);
});

test("confirmed agreement can satisfy a B1 campaign only with attributed generated supply", () => {
  assert.match(helper, /resulting_listing_id/);
  assert.match(helper, /target_user_id/);
  assert.match(helper, /status: "satisfied"/);
  assert.match(helper, /agreement\.status === "confirmed"/);
});
