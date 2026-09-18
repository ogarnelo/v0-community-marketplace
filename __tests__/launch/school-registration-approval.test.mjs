import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("school registration requires an authenticated user", () => {
  const layout = read("app/register-school/layout.tsx");

  assert.match(layout, /supabase\.auth\.getUser\(\)/);
  assert.match(layout, /redirect\("\/auth\?next=\/register-school"\)/);
});

test("school requests go through the hardened server endpoint and stay pending", () => {
  const page = read("app/register-school/page.tsx");
  const requestRoute = read("app/api/schools/requests/route.ts");
  const approvalRoute = read("app/api/admin/approve-school-request/route.ts");
  const rejectionRoute = read("app/api/admin/reject-school-request/route.ts");

  assert.match(page, /fetch\("\/api\/schools\/requests"/);
  assert.doesNotMatch(page, /from\("school_registration_requests"\)\.insert/);
  assert.doesNotMatch(page, /from\("schools"\)\.insert/);
  assert.match(page, /superadmin podrá aprobar su alta/);

  assert.match(requestRoute, /email_confirmed_at/);
  assert.match(requestRoute, /MIN_ACCOUNT_AGE_MS/);
  assert.match(requestRoute, /MAX_REQUESTS_PER_DAY/);
  assert.match(requestRoute, /requested_by: user\.id/);
  assert.match(requestRoute, /status: "pending"/);
  assert.match(requestRoute, /sendSchoolRegistrationAdminEmail/);

  assert.match(approvalRoute, /eq\("role", "super_admin"\)/);
  assert.doesNotMatch(approvalRoute, /SUPERADMIN_EMAILS/);
  assert.match(approvalRoute, /createAdminClient/);
  assert.match(approvalRoute, /adminSupabase\.rpc\([\s\S]*approve_school_registration_request/);

  assert.match(rejectionRoute, /eq\("role", "super_admin"\)/);
  assert.match(rejectionRoute, /createAdminClient/);
  assert.match(rejectionRoute, /admin\.rpc\("reject_school_registration_request"/);
});

test("browser clients cannot insert school registration requests after server gate", () => {
  const migration = read(
    "supabase/migrations/20260917220600_school_request_server_gate.sql"
  );

  assert.match(migration, /revoke insert[\s\S]*from anon/i);
  assert.match(migration, /revoke insert[\s\S]*from authenticated/i);
  assert.match(migration, /drop policy if exists school_registration_requests_insert_authenticated/i);
});

test("school requests notify superadmins in app", () => {
  const migration = read(
    "supabase/migrations/20260917220500_launch_security_hardening.sql"
  );

  assert.match(migration, /notify_superadmins_on_school_request/);
  assert.match(migration, /school_registration_requested/);
  assert.match(migration, /where ur\.role = 'super_admin'/);
});


test("superadmin can record a rejection reason and pending requests are prioritized", () => {
  const dashboard = read("components/admin/super-admin-dashboard.tsx");

  assert.match(dashboard, /requestRejectNotes/);
  assert.match(dashboard, /fetch\("\/api\/admin\/reject-school-request"/);
  assert.doesNotMatch(dashboard, /supabase\.rpc\("reject_school_registration_request"/);
  assert.match(dashboard, /Motivo de rechazo \(opcional\)/);
  assert.match(dashboard, /slice\(0, 500\)/);
  assert.match(dashboard, /notes: reviewNotes \|\| null/);
  assert.match(dashboard, /review_notes: reviewNotes \|\| null/);
  assert.match(dashboard, /orderedSchoolRequests/);
  assert.match(dashboard, /aPending/);
});
