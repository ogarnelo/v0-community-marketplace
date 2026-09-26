import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const marketplace = read("components/marketplace/marketplace-client.tsx");
const savedSearchRoute = read("app/api/marketplace/saved-searches/route.ts");
const searchEventsRoute = read("app/api/marketplace/search-events/route.ts");
const conversationPage = read("app/messages/[id]/page.tsx");
const conversationFeedback = read("components/messages/conversation-outcome-feedback.tsx");
const conversationFeedbackRoute = read("app/api/conversations/outcome-feedback/route.ts");
const demandAdmin = read("app/admin/super/demand/page.tsx");
const expandableAdminList = read("components/admin/expandable-admin-list.tsx");
const migration = read("supabase/migrations/20260924095000_demand_observation_phase_a.sql");

test("zero-result searches become explicit structured demand without replacing saved searches", () => {
  assert.match(marketplace, /¿Qué necesitas exactamente\?/);
  assert.match(marketplace, /needDetails: demandDetails\.trim\(\) \|\| searchQuery\.trim\(\) \|\| null/);
  assert.match(marketplace, /intentSource: "zero_results_prompt"/);
  assert.match(marketplace, /Guardar demanda y avisarme/);
  assert.match(savedSearchRoute, /need_details: needDetails/);
  assert.match(savedSearchRoute, /intent_source: intentSource/);
  assert.match(migration, /add column if not exists need_details text/);
  assert.match(migration, /add column if not exists intent_source text/);
});


test("saved demand remains compatible with the existing production table", () => {
  assert.match(savedSearchRoute, /const savedSearchName =/);
  assert.match(savedSearchRoute, /name: savedSearchName/);
  assert.match(savedSearchRoute, /needDetails \|\|[\s\S]*query \|\|[\s\S]*isbnQuery \|\|[\s\S]*category \|\|[\s\S]*gradeLevel/);
});

test("demand text survives filter changes and clears only on explicit reset or successful save", () => {
  const filterResetEffect = /useEffect\(\(\) => \{\s*setSaveSearchStatus\("idle"\);\s*\}, \[searchQuery, isbnQuery, category, gradeLevel, listingType, condition, onlyMyCommunity, priceRange, distanceKm, publishedDateFilter\]\);/;
  assert.match(marketplace, filterResetEffect);
  assert.doesNotMatch(marketplace, /setSaveSearchStatus\("idle"\);\s*setDemandDetails\(""\);\s*\}, \[searchQuery/);
  assert.match(marketplace, /const clearFilters = \(\) => \{[^}]*setDemandDetails\(""\);/);
  assert.match(marketplace, /setSaveSearchStatus\("saved"\); setDemandDetails\(""\);/);
});

test("stale conversation feedback is participant-only and waits seven days", () => {
  assert.match(conversationFeedbackRoute, /STALE_CONVERSATION_DAYS = 7/);
  assert.match(conversationFeedbackRoute, /conversation\.buyer_id === user\.id/);
  assert.match(conversationFeedbackRoute, /conversation\.seller_id === user\.id/);
  assert.match(conversationFeedbackRoute, /conversation_not_stale/);
  assert.match(conversationFeedbackRoute, /conversation_outcome_feedback/);
  assert.match(conversationPage, /isConversationStale/);
  assert.match(conversationPage, /ConversationOutcomeFeedback/);
  assert.match(conversationFeedback, /¿Qué ocurrió con esta conversación\?/);
});

test("conversation outcome storage is additive, idempotent per participant and visible to super admin", () => {
  assert.match(migration, /create table if not exists public\.conversation_outcome_feedback/);
  assert.match(migration, /unique \(conversation_id, user_id\)/);
  assert.match(migration, /revoke all on table public\.conversation_outcome_feedback from authenticated/);
  assert.match(migration, /grant select on table public\.conversation_outcome_feedback to authenticated/);
  assert.match(migration, /auth\.uid\(\)\) = user_id/);
  assert.match(migration, /public\.is_superadmin\(\)/);
  assert.match(demandAdmin, /conversation_outcome_feedback/);
  assert.match(demandAdmin, /Demanda explícita/);
  assert.match(demandAdmin, /Conversaciones que no avanzaron/);
});

test("phase A observes demand only and does not activate sellers or commerce", () => {
  assert.doesNotMatch(conversationFeedbackRoute, /stripe|sendcloud|checkout|payout/i);
  assert.doesNotMatch(savedSearchRoute, /stripe|sendcloud|checkout|payout/i);
  assert.doesNotMatch(demandAdmin, /activar vendedores|enviar campaña automáticamente/i);
});


test("ISBN telemetry waits for a complete valid ISBN instead of recording typing prefixes", () => {
  assert.match(marketplace, /isIncompleteIsbnLikeInput/);
  assert.match(marketplace, /canonicalIsbn/);
  assert.match(searchEventsRoute, /reason: "incomplete_isbn"/);
  assert.match(searchEventsRoute, /extractIsbnFromText/);
  assert.match(searchEventsRoute, /normalizeIsbn/);
  assert.match(demandAdmin, /isIncompleteIsbnLikeInput/);
});


test("demand intelligence keeps long sections compact by default", () => {
  assert.match(demandAdmin, /ExpandableAdminList initialCount=\{5\}/);
  assert.match(expandableAdminList, /Ver más/);
  assert.match(expandableAdminList, /Ver menos/);
});
