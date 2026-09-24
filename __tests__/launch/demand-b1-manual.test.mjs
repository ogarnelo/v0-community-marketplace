import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const helper = read("lib/admin/demand-opportunities.ts");
const migration = read("supabase/migrations/20260924133000_demand_b1_manual_activation.sql");
const constraintFix = read("supabase/migrations/20260924123216_fix_demand_b1_constraints.sql");
const demandPage = read("app/admin/super/demand/page.tsx");
const opportunityPage = read("app/admin/super/demand/opportunity/[key]/page.tsx");
const activationComponent = read("components/admin/demand-candidate-activation.tsx");
const activationRoute = read("app/api/admin/demand/opportunities/[key]/activate/route.ts");
const sellerPage = read("app/supply-opportunity/[key]/page.tsx");
const responseRoute = read("app/api/demand/opportunities/[key]/response/route.ts");
const newListingPage = read("app/marketplace/new/page.tsx");
const newListingForm = read("components/marketplace/new-listing-form.tsx");
const matcher = read("app/api/marketplace/listings/match-saved-searches/route.ts");
const notificationBell = read("components/notifications/navbar-notifications-bell.tsx");

test("B1 reuses existing demand campaign/action infrastructure", () => {
  assert.match(helper, /demand_campaigns/);
  assert.match(helper, /demand_opportunity_actions/);
  assert.doesNotMatch(migration, /create table[^;]*demand_opportunities/i);
  assert.match(migration, /demand_campaigns_opportunity_key_uidx/);
});

test("opportunity grouping is deterministic and ISBN-first", () => {
  assert.match(helper, /createHash\("sha256"\)/);
  assert.match(helper, /normalizeIsbn/);
  assert.match(helper, /isbn:\$\{canonical\}/);
  assert.match(helper, /queryTokens/);
  assert.match(helper, /school:/);
});

test("candidate search excludes students, demanders and recently contacted users", () => {
  assert.match(helper, /profile\.user_type === "student"/);
  assert.match(helper, /demanders\.has\(sellerId\)/);
  assert.match(helper, /recentlyContacted\.has\(sellerId\)/);
  assert.match(helper, /sameIsbn/);
  assert.match(helper, /sameSchoolCategory/);
  assert.match(helper, /reasons/);
});

test("manual activation fields are added without email automation", () => {
  assert.match(migration, /target_user_id/);
  assert.match(migration, /resulting_listing_id/);
  assert.match(migration, /responded_at/);
  assert.doesNotMatch(helper, /sendEmail|Resend|campaign email/i);
});

test("Super Admin exposes grouped demand with filters and manual candidate search", () => {
  assert.match(demandPage, /Oportunidades de demanda/);
  assert.match(demandPage, /Buscar oferta potencial/);
  assert.match(demandPage, /name="school"/);
  assert.match(demandPage, /name="category"/);
  assert.match(demandPage, /name="status"/);
  assert.match(demandPage, /name="isbn"/);
  assert.match(demandPage, /name="supply"/);
  assert.match(demandPage, /name="intensity"/);
  assert.match(opportunityPage, /DemandCandidateActivation/);
  assert.match(opportunityPage, /Anuncios generados/);
});

test("seller activation is manual, server-validated and in-app only", () => {
  assert.match(activationComponent, /Previsualización del mensaje/);
  assert.match(activationRoute, /eq\("role", "super_admin"\)/);
  assert.match(activationRoute, /findSupplyCandidates/);
  assert.match(activationRoute, /profile\.user_type === "student"/);
  assert.match(activationRoute, /kind: "supply_activation"/);
  assert.match(activationRoute, /channel: "in_app"/);
  assert.doesNotMatch(activationRoute, /sendEmail|Resend|sendSavedSearchMatchEmail/);
  assert.match(sellerPage, /SupplyOpportunityResponse/);
  assert.match(responseRoute, /"have_one"/);
  assert.match(responseRoute, /"dont_have"/);
});

test("publish-now prefill is recovered server-side and the listing remains normal", () => {
  assert.match(newListingPage, /demand_opportunity_actions/);
  assert.match(newListingPage, /target_user_id", user\.id/);
  assert.match(newListingPage, /initialPrefill=\{initialPrefill\}/);
  assert.match(newListingForm, /activationOpportunityKey/);
  assert.match(newListingForm, /opportunityKey: activationOpportunityKey/);
  assert.doesNotMatch(newListingForm, /school_id: initialPrefill/);
});

test("new supply closes the B1 loop and saved-search in-app notices are idempotent", () => {
  assert.match(migration, /saved_search_matches[\s\S]*notified_at/);
  assert.match(matcher, /resulting_listing_id: listing\.id/);
  assert.match(matcher, /status: "supply_generated"/);
  assert.match(matcher, /kind: "saved_search_match"/);
  assert.match(matcher, /saved_search_match_id: match\.id/);
  assert.match(matcher, /is\("notified_at", null\)/);
  assert.match(notificationBell, /case "supply_activation":/);
  assert.match(notificationBell, /case "saved_search_match":/);
});


test("Demand B1 database checks accept the states and action used by the live flow", () => {
  assert.match(constraintFix, /'sellers_contacted'::text/);
  assert.match(constraintFix, /'supply_generated'::text/);
  assert.match(constraintFix, /'satisfied'::text/);
  assert.match(constraintFix, /'seller_contacted'::text/);
  assert.match(constraintFix, /'suggested'::text/);
  assert.match(constraintFix, /'supplier_outreach'::text/);
});
