import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("legacy payment review endpoint is closed with the rest of commerce during MVP", () => {
  const route = read("app/api/reviews/create/route.ts");

  assert.match(route, /isLegacyCommerceEnabled/);
  assert.match(route, /status: 404/);
});

test("demand analytics cannot be anonymously poisoned", () => {
  const route = read("app/api/marketplace/search-events/route.ts");

  assert.match(route, /auth_required_for_analytics/);
  assert.match(route, /user_id: user\.id/);
  assert.match(route, /source_path: "\/marketplace"/);
  assert.doesNotMatch(route, /user_id: user\?\.id \|\| null/);
});

test("donation school scope comes from the listing, never from client input", () => {
  const route = read("app/api/donations/request/route.ts");
  const service = read("lib/services/donations.service.ts");

  assert.doesNotMatch(route, /body\?\.schoolId/);
  assert.match(route, /slice\(0, 500\)/);
  assert.match(service, /school_id: listing\.school_id \|\| null/);
  assert.doesNotMatch(service, /schoolId \|\| listing\.school_id/);
});

test("user_roles gets an explicit primary key without changing role uniqueness rules", () => {
  const migration = read("supabase/migrations/20260918063500_user_roles_primary_key.sql");

  assert.match(migration, /add column if not exists id uuid default gen_random_uuid\(\)/);
  assert.match(migration, /primary key \(id\)/);
  assert.doesNotMatch(migration, /drop index/);
});


test("school admin privileges never come from user-editable auth metadata", () => {
  const callback = read("app/auth/callback/route.ts");
  const approval = read("app/api/admin/approve-school-request/route.ts");
  const invitation = read("app/api/admin/invite-school-admin/route.ts");
  const roleGrant = read("lib/admin/school-admin-role.ts");

  assert.doesNotMatch(callback, /invited_role|invited_school_id|pending_school_admin_role|pending_school_admin_school_id/);
  assert.doesNotMatch(callback, /createAdminClient/);

  assert.match(approval, /grantSchoolAdminRole/);
  assert.match(invitation, /grantSchoolAdminRole/);
  assert.doesNotMatch(approval, /invited_role|invited_school_id/);
  assert.doesNotMatch(invitation, /pending_school_admin_role|pending_school_admin_school_id/);

  assert.match(roleGrant, /findAuthUserByEmail/);
  assert.match(roleGrant, /from\("schools"\)/);
  assert.match(roleGrant, /from\("user_roles"\)/);
  assert.match(roleGrant, /role: "school_admin"/);
  assert.match(roleGrant, /from\("profiles"\)/);
});


test("listing deletion preserves moderation and conversation history", () => {
  const route = read("app/api/listings/delete/route.ts");

  assert.match(route, /hasModerationOrConversationHistory/);
  assert.match(route, /from\("reports"\)[\s\S]*select\("id"\)/);
  assert.match(route, /mode: "archived"/);
  assert.doesNotMatch(route, /from\("reports"\)\.delete/);
});


test("moderation reports are created through a validated server gate", () => {
  const route = read("app/api/reports/route.ts");
  const listing = read("components/marketplace/report-listing-button.tsx");
  const conversation = read("components/messages/report-conversation-button.tsx");
  const migration = read("supabase/migrations/20260918204000_server_gate_reports.sql");

  assert.match(route, /MAX_REPORTS_PER_HOUR = 10/);
  assert.match(route, /email_confirmed_at/);
  assert.match(route, /targetType === "listing"/);
  assert.match(route, /conversation\.buyer_id !== user\.id/);
  assert.match(route, /\.in\("status", \["open", "reviewing"\]\)/);
  assert.match(route, /created_at/);
  assert.match(route, /insertError\.code === "23505"/);

  assert.match(listing, /fetch\("\/api\/reports"/);
  assert.match(conversation, /fetch\("\/api\/reports"/);
  assert.doesNotMatch(listing, /from\("reports"\)\.insert/);
  assert.doesNotMatch(conversation, /from\("reports"\)\.insert/);

  assert.match(migration, /revoke insert, delete, truncate, references, trigger/);
  assert.match(migration, /reports_active_listing_reporter_unique_idx/);
  assert.match(migration, /reports_active_conversation_reporter_unique_idx/);
  assert.match(migration, /notify_superadmins_on_report/);
});
