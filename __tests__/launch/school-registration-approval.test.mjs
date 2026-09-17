import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("school registration requires an authenticated user", () => {
  const layout = read("app/register-school/layout.tsx");

  assert.match(layout, /supabase\.auth\.getUser\(\)/);
  assert.match(layout, /redirect\("\/auth\?next=\/register-school"\)/);
});

test("school requests stay pending until the superadmin approves them", () => {
  const page = read("app/register-school/page.tsx");
  const approvalRoute = read("app/api/admin/approve-school-request/route.ts");

  assert.match(page, /from\("school_registration_requests"\)\.insert/);
  assert.doesNotMatch(page, /from\("schools"\)\.insert/);
  assert.match(page, /superadmin podrá aprobar su alta/);
  assert.match(approvalRoute, /SUPERADMIN_EMAILS/);
  assert.match(approvalRoute, /approve_school_registration_request/);
});

test("anonymous users cannot insert school registration requests", () => {
  const migration = read(
    "supabase/migrations/20260917204500_harden_school_registration_requests.sql"
  );

  assert.match(migration, /revoke insert[\s\S]*from anon/i);
  assert.match(migration, /drop policy if exists school_registration_requests_insert_public/i);
  assert.match(migration, /create policy school_registration_requests_insert_authenticated/i);
  assert.match(migration, /for insert[\s\S]*to authenticated[\s\S]*auth\.uid\(\)/i);
});
