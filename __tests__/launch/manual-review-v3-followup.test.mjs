import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const marketplacePage = read("app/marketplace/page.tsx");
const marketplaceClient = read("components/marketplace/marketplace-client.tsx");
const listingCard = read("components/listing-card.tsx");
const chatMessages = read("components/messages/realtime-chat-messages.tsx");
const publicProfile = read("app/profile/[id]/page.tsx");
const conversationPage = read("app/messages/[id]/page.tsx");
const agreementPanel = read("components/agreements/agreement-panel.tsx");
const activityPage = read("app/account/activity/page.tsx");
const adminControls = read("components/admin/report-status-controls.tsx");
const adminRoute = read("app/api/admin/reports/status/route.ts");
const migration = read("supabase/migrations/20260923223000_report_resolution_feedback.sql");
const messageSendRoute = read("app/api/messages/send/route.ts");
const notificationBell = read("components/notifications/navbar-notifications-bell.tsx");

test("marketplace derives community badges from the seller current profile", () => {
  assert.match(marketplacePage, /createAdminClient/);
  assert.match(marketplacePage, /sellerProfileMap/);
  assert.match(marketplacePage, /currentSellerSchoolId/);
  assert.match(marketplacePage, /sellerProfile\?\.postalCode/);
  assert.match(marketplacePage, /schoolId: currentSellerSchoolId/);
});

test("marketplace is compact and uses two columns on mobile", () => {
  assert.match(marketplaceClient, /grid grid-cols-2 gap-2/);
  assert.match(listingCard, /group gap-0[\s\S]*py-0/);
  assert.match(listingCard, /px-2\.5 pb-2\.5 pt-2/);
});

test("chat only re-anchors when the last message changes", () => {
  assert.match(chatMessages, /const lastMessageId = messages\[messages\.length - 1\]\?\.id/);
  assert.match(chatMessages, /behavior: "auto"/);
  assert.match(chatMessages, /block: "end"/);
  assert.match(chatMessages, /\}, \[lastMessageId\]\);/);
  assert.doesNotMatch(chatMessages, /\}, \[messages\]\);/);
});

test("every direct chat message creates an idempotent bell notification", () => {
  assert.match(messageSendRoute, /kind: "message_received"/);
  assert.match(messageSendRoute, /contains\("metadata", \{ message_id: message\.id \}\)/);
  assert.match(messageSendRoute, /href: `\/messages\/\$\{conversation\.id\}`/);
  assert.match(notificationBell, /case "message_received":/);
  assert.match(notificationBell, /return "Mensaje"/);
});

test("public profiles expose the individual review text", () => {
  assert.match(publicProfile, /<CardTitle>Opiniones<\/CardTitle>/);
  assert.match(publicProfile, /stats\.reviews\.map/);
  assert.match(publicProfile, /review\.comment\?\.trim\(\)/);
  assert.match(publicProfile, /reviewProfileMap/);
});

test("a user can report an agreement only once while the other participant keeps their own option", () => {
  assert.match(conversationPage, /from\("reports"\)/);
  assert.match(conversationPage, /eq\("reporter_id", user\.id\)/);
  assert.match(conversationPage, /initialReport=\{myAgreementReport\}/);
  assert.match(agreementPanel, /initialReport/);
  assert.match(agreementPanel, /\{!report \? \(/);
  assert.match(agreementPanel, /Reportar problema/);
  assert.match(agreementPanel, /Ver mi incidencia/);
});

test("users can review incident outcomes and admin responses", () => {
  assert.match(activityPage, /<CardTitle>Mis incidencias<\/CardTitle>/);
  assert.match(activityPage, /resolution_note/);
  assert.match(activityPage, /report-\$\{report\.id\}/);
  assert.match(activityPage, /Respuesta de Wetudy/);
});

test("super admin resolution can include a response and creates a reporter notification", () => {
  assert.match(adminControls, /Respuesta al usuario/);
  assert.match(adminControls, /resolutionNote/);
  assert.match(adminRoute, /p_resolution_note/);
  assert.match(migration, /add column if not exists resolution_note text/);
  assert.match(migration, /moderation_report_resolved/);
  assert.match(migration, /Incidencia resuelta/);
  assert.match(migration, /Incidencia descartada/);
  assert.match(migration, /server_update_report_status\([\s\S]*p_resolution_note text/);
  assert.match(migration, /server_update_report_status\([\s\S]*null::text/);
});
