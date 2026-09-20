import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const page = read("app/admin/school/page.tsx");
const dashboard = read("components/admin/school-admin-dashboard.tsx");
const metrics = read("lib/admin/school-dashboard-metrics.ts");
const donationReview = read("app/api/donations/review/route.ts");
const editListing = read("app/marketplace/edit/[id]/page.tsx");
const donationService = read("lib/services/donations.service.ts");

test("school dashboard serializes aggregate metrics instead of individual activity rows", () => {
  assert.match(page, /buildSchoolDashboardMetrics/);
  assert.match(page, /select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(page, /select\("user_id", \{ count: "exact", head: true \}\)/);
  assert.doesNotMatch(page, /DonationRequestsPanel|donation_requests|requesterProfiles|requesterName/);
  assert.doesNotMatch(page, /select\("id, full_name, school_id, user_type, grade_level"\)/);
  assert.match(page, /school_impact_report_deliveries[\s\S]*\.eq\("user_id", user\.id\)/);

  assert.match(dashboard, /metrics: SchoolDashboardMetrics/);
  assert.match(dashboard, /metrics\.ranges\[range\]/);
  assert.doesNotMatch(dashboard, /listings: ListingRow\[\]|members: ProfileRow\[\]|agreements: AgreementRow\[\]/);
  assert.doesNotMatch(dashboard, /schoolAdmins\.map|admin\.full_name/);
  assert.match(dashboard, /No expone nombres de miembros,[\s\S]*conversaciones ni el detalle de acuerdos/);
});

test("school impact ranges are calculated server-side from non-identifying metric rows", () => {
  assert.match(metrics, /"90d", "365d", "total"/);
  assert.match(metrics, /publishedListings/);
  assert.match(metrics, /reusedItems/);
  assert.match(metrics, /listingViews/);
  assert.match(metrics, /membersCount/);
  assert.match(metrics, /schoolAdminsCount/);
  assert.doesNotMatch(metrics, /full_name|requester_id|conversation_id/);
});

test("school admins cannot approve or reject individual donations", () => {
  assert.match(donationReview, /if \(!adminFlags\.isSuperAdmin\)/);
  assert.doesNotMatch(donationReview, /schoolAdminSchoolId/);
  assert.doesNotMatch(editListing, /admin de tu centro gestionará las solicitudes/i);
  assert.match(editListing, /Gestiona las solicitudes directamente con la otra persona por chat/);
  assert.match(donationService, /acordar la entrega directamente por este chat/);
  assert.doesNotMatch(donationService, /entrega en mano o el envío/);
});
