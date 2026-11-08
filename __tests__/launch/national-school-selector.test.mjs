import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20261108121500_account_students_directory_school_selection.sql");
const lookup = read("app/api/account/schools/directory/route.ts");
const server = read("lib/account-students/server.ts");
const context = read("components/account-students/student-context-fields.tsx");
const onboarding = read("components/onboarding/account-students-onboarding.tsx");
const account = read("components/account/account-students-section.tsx");
const course = read("app/mi-curso/page.tsx");

test("national school choice is a separate FK, never an active community FK", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS directory_school_code text/);
  assert.match(migration, /REFERENCES public\.school_directory\(official_code\)/);
  assert.match(migration, /school_id IS NULL OR directory_school_code IS NULL/);
  assert.doesNotMatch(migration, /UPDATE public\.schools|SET is_listed = true|SET seo_indexable = true/i);
});

test("directory lookup requires verified auth and returns only minimal school metadata", () => {
  assert.match(lookup, /supabase\.auth\.getUser\(\)/);
  assert.match(lookup, /!user\?\.email_confirmed_at/);
  assert.match(lookup, /"private, no-store"/);
  assert.match(lookup, /query\.length < 3/);
  assert.match(lookup, /MAX_RESULTS = 20/);
  assert.match(lookup, /select\("official_code,name,municipality,province,postal_code"\)/);
  assert.doesNotMatch(lookup, /\.eq\("is_listed", true\)/);
  assert.doesNotMatch(lookup, /profiles\)|user_roles\)|\.insert\(|\.upsert\(|\.update\(/);
});

test("student input validates mutually exclusive operational and directory identity", () => {
  assert.match(server, /directorySchoolCode/);
  assert.match(server, /schoolId && directorySchoolCode/);
  assert.match(server, /ensureDirectorySchool/);
  assert.match(server, /directory_school_code: input\.directorySchoolCode/);
  assert.match(server, /ensureActiveSchool/);
});

test("user can search, select, edit and retain directory school", () => {
  assert.match(context, /\/api\/account\/schools\/directory\?q=/);
  assert.match(context, /onDirectorySchoolCodeChange/);
  assert.match(context, /onSchoolIdChange/);
  assert.match(onboarding, /directorySchoolCode: draft\.directorySchoolCode/);
  assert.match(account, /directorySchoolCode: draft\.directorySchoolCode/);
  assert.match(course, /directorySchools\.get/);
});
