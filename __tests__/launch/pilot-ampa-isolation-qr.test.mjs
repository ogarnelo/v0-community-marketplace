import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const qrRoute = read("app/api/school/share-qr/route.ts");
const originHelper = read("lib/auth/public-origin.ts");
const migration = read("supabase/migrations/20260920111500_profile_privacy_hardening.sql");
const fixture = read("scripts/pilot-two-school-isolation.sh");
const workflow = read(".github/workflows/pilot-two-school-isolation.yml");

test("AMPA QR encodes only trusted Wetudy public domain with correct school role", () => {
  assert.match(qrRoute, /getAuthPublicOrigin\(\)/);
  assert.doesNotMatch(qrRoute, /new URL\(request\.url\)\.origin/);
  assert.match(originHelper, /https:\/\/www\.wetudy\.com/);
  assert.match(qrRoute, /schoolRole\?\.school_id/);
  assert.match(qrRoute, /baseShareUrl\.searchParams\.set\("school", schoolRole\.school_id\)/);
});

test("two-centre fixture implements same school-code access policy as production", () => {
  assert.match(migration, /create policy school_access_codes_select_authorized/);
  assert.match(migration, /ur\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /ur\.role = 'school_admin'/);
  assert.match(migration, /ur\.school_id = school_access_codes\.school_id/);
  assert.match(fixture, /CREATE POLICY school_access_codes_select_authorized/);
  assert.match(fixture, /ur\.role='school_admin'/);
  assert.match(fixture, /ur\.school_id=school_access_codes\.school_id/);
  assert.match(fixture, /School A isolated access failed/);
  assert.match(fixture, /School B isolated access failed/);
  assert.match(fixture, /Family accessed restricted centre records/);
  assert.match(fixture, /Privilege escalation unexpectedly succeeded/);
  assert.match(fixture, /Superadmin expected global access failed/);
});

test("test runs only in disposable localhost Postgres and never sends emails", () => {
  assert.match(fixture, /Refusing to run RLS tests against a nonlocal database/);
  assert.match(workflow, /postgres:17/);
  assert.match(workflow, /127\.0\.0\.1:5432/);
  assert.doesNotMatch(fixture, /supabase\.co|api\.resend\.com|send-email|email/);
});

test("isolated moderation test uses the actual resolution RPC and cannot touch production", () => {
  const script = read("scripts/pilot-report-resolution-sandbox.sh");
  const migration = read("supabase/migrations/20261108195500_report_status_idempotent_notifications.sql");
  const flow = read(".github/workflows/pilot-two-school-isolation.yml");
  assert.match(script, /Refusing to test moderation resolution against nonlocal DB/);
  assert.match(script, /server_update_report_status/);
  assert.match(script, /20261108195500_report_status_idempotent_notifications\.sql/);
  assert.match(script, /School admin was allowed to moderate globally/);
  assert.match(script, /Agreement must remain disputed while second report is active/);
  assert.match(script, /Closing all reports did not restore agreement and notify/);
  assert.match(script, /Case status, notifications or audit events are inconsistent/);
  assert.match(migration, /p_resolution_note text/);
  assert.match(migration, /role = 'super_admin'/);
  assert.match(migration, /v_previous_status is distinct from p_status/);
  assert.match(script, /Idempotent duplicate moderation POST created notifications\/events/);
  assert.match(script, /Note-only moderation update changed resolution identity or created duplicates/);
  assert.match(flow, /wetudy_moderation/);
  assert.doesNotMatch(script, /supabase\.co|WETUDY_BACKUP_DATABASE_URL/);
});
