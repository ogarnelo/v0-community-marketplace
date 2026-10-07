import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("institutional access requests are public but remain manually approved", () => {
  const layout = read("app/register-school/layout.tsx");
  const page = read("app/register-school/page.tsx");

  assert.match(layout, /getNavbarData/);
  assert.doesNotMatch(layout, /redirect\("\/auth\?next=\/register-school"\)/);
  assert.match(page, /Solicitud de alta para AMPAs y centros/);
  assert.match(page, /Persona de contacto \*/);
  assert.match(page, /Cargo \/ función \*/);
  assert.match(page, /Telefono de contacto \*/);
  assert.match(page, /organizationUrl/);
});

test("school requests go through the hardened server endpoint and stay pending", () => {
  const page = read("app/register-school/page.tsx");
  const requestRoute = read("app/api/schools/requests/route.ts");
  const approvalRoute = read("app/api/admin/approve-school-request/route.ts");
  const rejectionRoute = read("app/api/admin/reject-school-request/route.ts");

  assert.match(page, /fetch\("\/api\/schools\/requests"/);
  assert.doesNotMatch(page, /from\("school_registration_requests"\)\.insert/);
  assert.doesNotMatch(page, /from\("schools"\)\.insert/);
  assert.match(page, /revisión manual/);

  assert.doesNotMatch(requestRoute, /email_confirmed_at/);
  assert.doesNotMatch(requestRoute, /MIN_ACCOUNT_AGE_MS/);
  assert.match(requestRoute, /MAX_REQUESTS_PER_DAY/);
  assert.match(requestRoute, /requested_by: user\?\.id \|\| null/);
  assert.match(requestRoute, /organization_name: organizationName/);
  assert.match(requestRoute, /contact_name: contactName/);
  assert.match(requestRoute, /contact_role: contactRole/);
  assert.match(requestRoute, /organization_url: organizationUrl \|\| null/);
  assert.match(requestRoute, /requested_school_id: requestedSchoolId \|\| null/);
  assert.match(requestRoute, /eq\("id", requestedSchoolId\)/);
  assert.match(requestRoute, /eq\("is_active", true\)/);
  assert.match(requestRoute, /contactPhone\.length < 6/);
  assert.match(requestRoute, /recentEmailRequests/);
  assert.match(requestRoute, /recentPhoneRequests/);
  assert.match(requestRoute, /status: "pending"/);
  assert.match(requestRoute, /sendSchoolRegistrationAdminEmail/);

  assert.match(approvalRoute, /eq\("role", "super_admin"\)/);
  assert.doesNotMatch(approvalRoute, /SUPERADMIN_EMAILS/);
  assert.match(approvalRoute, /createAdminClient/);
  assert.match(approvalRoute, /adminSupabase\.rpc\([\s\S]*server_approve_school_registration_request/);\n  assert.match(approvalRoute, /reviewer_id: user\.id/);
  assert.doesNotMatch(approvalRoute, /await supabase\.rpc\([\s\S]*approve_school_registration_request/);

  assert.match(rejectionRoute, /eq\("role", "super_admin"\)/);
  assert.match(rejectionRoute, /createAdminClient/);
  assert.match(rejectionRoute, /admin\.rpc\("server_reject_school_registration_request"/);\n  assert.match(rejectionRoute, /reviewer_id: user\.id/);
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


test("server school review RPCs validate reviewer id without relying on auth.uid", () => {
  const migration = read(
    "supabase/migrations/20260919062500_fix_server_school_review_context.sql"
  );

  assert.match(migration, /server_approve_school_registration_request/);
  assert.match(migration, /server_reject_school_registration_request/);
  assert.match(migration, /ur\.user_id = reviewer_id/);
  assert.match(migration, /ur\.role = 'super_admin'/);
  assert.match(migration, /reviewed_by = reviewer_id/);
  assert.match(migration, /grant execute[\s\S]*to service_role/i);
  assert.doesNotMatch(migration, /auth\.uid\(\)/);
});


test("AMPA verification fields are additive and stored in migration history", () => {
  const migration = read("supabase/migrations/20261007063811_ampa_access_request_identity.sql");
  const dashboard = read("components/admin/super-admin-dashboard.tsx");

  assert.match(migration, /organization_name text/);
  assert.match(migration, /contact_name text/);
  assert.match(migration, /contact_role text/);
  assert.match(migration, /organization_url text/);
  assert.match(dashboard, /request\.organization_name/);
  assert.match(dashboard, /request\.contact_name/);
  assert.match(dashboard, /request\.contact_role/);
  assert.match(dashboard, /Ver web \/ red oficial/);
});


test("existing school access requests reuse the centre instead of duplicating it", () => {
  const page = read("app/register-school/page.tsx");
  const migration = read("supabase/migrations/20261007065500_school_access_request_existing_center.sql");
  const dashboard = read("components/admin/super-admin-dashboard.tsx");

  assert.match(page, /Mi centro ya está en Wetudy/);
  assert.match(page, /Mi centro todavía no está en Wetudy/);
  assert.match(page, /existingSchoolId/);
  assert.match(page, /no se creará un duplicado/);
  assert.match(migration, /requested_school_id uuid references public\.schools/);
  assert.match(migration, /if req\.requested_school_id is not null then/);
  assert.match(migration, /where s\.id = req\.requested_school_id/);
  assert.match(migration, /insert into public\.schools/);
  assert.match(dashboard, /Acceso a centro existente/);
  assert.match(dashboard, /Alta de nuevo centro/);
});
