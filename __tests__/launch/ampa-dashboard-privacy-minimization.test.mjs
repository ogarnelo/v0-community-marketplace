import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(file, "utf8");
const page = read("app/admin/school/page.tsx");
const dashboard = read("components/admin/school-admin-dashboard.tsx");
const privacy = read("app/privacy/page.tsx");

test("AMPA dashboard gets an aggregate count, never an array of family profiles", () => {
  assert.match(page, /const memberCount = safeMembers\.length/);
  assert.match(page, /memberCount=\{memberCount\}/);
  assert.match(dashboard, /memberCount: number/);
  assert.match(dashboard, /String\(memberCount\)/);
  assert.doesNotMatch(page, /members=\{safeMembers\}/);
  assert.doesNotMatch(dashboard, /members: ProfileRow\[\]|members\.map\(/);
});

test("AMPA only fetches names for authorized school administrators", () => {
  assert.match(page, /\.select\("id, school_id"\)\s*\.limit\(10000\)/);
  assert.match(page, /\.select\("id, full_name"\)\s*\.in\("id", schoolAdminIds\)/);
  assert.match(page, /\.eq\("school_id", effectiveSchoolId\)/);
  assert.match(page, /role === "school_admin" && Boolean\(role\.school_id\)/);
  assert.doesNotMatch(page, /select\("id, full_name, school_id, user_type, grade_level"\)/);
});

test("aggregated AMPA metrics contain no private agreement row identifiers", () => {
  assert.match(page, /\.select\("listing_id, agreement_type, status, amount, confirmed_at, created_at"\)/);
  assert.match(dashboard, /type AgreementRow = \{\s*listing_id:/);
  assert.doesNotMatch(dashboard, /type AgreementRow = \{\s*id:/);
});

test("labels do not describe opted-in community as verified memberships", () => {
  assert.match(dashboard, /Cuentas que seleccionaron el centro/);
  assert.match(dashboard, /No implica pertenencia verificada/);
  assert.doesNotMatch(dashboard, /Miembros vinculados al centro/);
  assert.match(privacy, /información agregada y operativa de su centro/);
});
