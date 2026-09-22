import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const reviewHelper = read("lib/users/get-user-reviews.ts");
const stats = read("lib/users/get-user-profile-stats.ts");
const account = read("app/account/page.tsx");
const reviewsPage = read("app/account/reviews/page.tsx");
const listing = read("app/marketplace/listing/[id]/page.tsx");
const panel = read("components/agreements/agreement-panel.tsx");
const disputeRoute = read("app/api/agreements/dispute/route.ts");
const adminDetail = read("app/admin/super/reports/[id]/page.tsx");
const adminDashboard = read("components/admin/super-admin-dashboard.tsx");
const notification = read("lib/notifications.ts");
const statusRoute = read("app/api/admin/reports/status/route.ts");
const migration = read("supabase/migrations/20260922215000_report_status_agreement_sync.sql");

test("all active review sources feed one reputation model", () => {
  assert.match(reviewHelper, /from\("agreement_reviews"\)/);
  assert.match(reviewHelper, /from\("reviews"\)/);
  assert.match(reviewHelper, /from\("transaction_reviews"\)/);
  assert.match(stats, /getUserReviews/);
  assert.match(reviewsPage, /getUserReviews/);
  assert.match(listing, /getUserReviews/);
});

test("account exposes reviews and counts real bilateral agreements", () => {
  assert.match(account, /href: "\/account\/reviews"/);
  assert.match(account, /eq\("buyer_id", user\.id\)/);
  assert.match(account, /eq\("seller_id", user\.id\)/);
  assert.match(account, /buyerAgreementsCount/);
  assert.match(account, /sellerAgreementsCount/);
});

test("agreement incident requires a reason and an explanation", () => {
  assert.match(panel, /INCIDENT_REASONS/);
  assert.match(panel, /Motivo de la incidencia/);
  assert.match(panel, /disputeDetails\.trim\(\)\.length < 10/);
  assert.match(panel, /Enviar incidencia/);
  assert.doesNotMatch(panel, /Incidencia reportada desde el chat/);
  assert.match(disputeRoute, /INCIDENT_REASON_LABELS/);
  assert.match(disputeRoute, /details\.length < 10/);
  assert.match(disputeRoute, /p_note: `\$\{reasonLabel\}\\n\$\{details\}`/);
});

test("super admin can inspect the full moderation context", () => {
  assert.match(adminDetail, /Qué ha ocurrido/);
  assert.match(adminDetail, /Historial del chat/);
  assert.match(adminDetail, /Valoraciones del acuerdo/);
  assert.match(adminDetail, /from\("messages"\)/);
  assert.match(adminDetail, /from\("agreement_reviews"\)/);
  assert.match(adminDetail, /ReportStatusControls/);
  assert.match(adminDashboard, /Ver detalle e historial/);
  assert.match(adminDashboard, /\/api\/admin\/reports\/status/);
  assert.doesNotMatch(adminDashboard, /from\("reports"\)[\s\S]{0,120}\.update\(/);
  assert.match(notification, /\/admin\/super\/reports\/\$\{encodeURIComponent\(reportId\)\}/);
});

test("resolving an incident also resolves agreement state coherently", () => {
  assert.match(statusRoute, /server_update_report_status/);
  assert.match(migration, /p_status in \('open', 'reviewing'\)/);
  assert.match(migration, /set status = 'disputed'/);
  assert.match(migration, /set status = 'confirmed'/);
  assert.match(migration, /status in \('open', 'reviewing'\)/);
  assert.match(migration, /agreement_incident_status_changed/);
});
