import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260927232500_account_students_foundation.sql",
  "utf8"
);
const accountPage = readFileSync("app/account/page.tsx", "utf8");

test("student persistence foundation is additive", () => {
  assert.match(migration, /create table if not exists public\.account_students/);
  assert.match(migration, /owner_user_id uuid not null references public\.profiles/);
  assert.match(migration, /relationship in \('self', 'guardian'\)/);
  assert.match(migration, /alias text/);
  assert.match(migration, /school_id uuid not null references public\.schools/);
  assert.match(migration, /grade_level text not null/);
  assert.match(migration, /academic_year text not null/);

  assert.doesNotMatch(migration, /alter table public\.profiles/);
  assert.doesNotMatch(migration, /alter table public\.listings/);
  assert.doesNotMatch(migration, /alter table public\.conversations/);
  assert.doesNotMatch(migration, /alter table public\.agreements/);
});

test("student-specific demand stays optional", () => {
  assert.match(
    migration,
    /alter table public\.demand_requests[\s\S]*add column if not exists student_id/
  );
  assert.match(
    migration,
    /alter table public\.saved_searches[\s\S]*add column if not exists student_id/
  );
  assert.match(migration, /on delete set null/);
});

test("student writes remain server-side and reads are owner scoped", () => {
  assert.match(migration, /enable row level security/);
  assert.match(
    migration,
    /revoke all on table public\.account_students from anon, authenticated/
  );
  assert.match(
    migration,
    /grant select on table public\.account_students to authenticated/
  );
  assert.match(migration, /account_students_select_own/);
  assert.match(migration, /auth\.uid\(\).*owner_user_id/);
});

test("legacy backfill is conservative and keeps profile compatibility", () => {
  assert.match(migration, /p\.school_id is not null/);
  assert.match(migration, /p\.grade_level is not null/);
  assert.match(migration, /p\.user_type in \('student', 'parent'\)/);
  assert.match(migration, /when p\.user_type = 'student' then 'self'/);
  assert.match(migration, /when p\.user_type = 'parent' then 'guardian'/);
  assert.doesNotMatch(migration, /update public\.profiles/);
});

test("production account layout is not converted into the beta account UI", () => {
  assert.doesNotMatch(accountPage, /account_students/);
  assert.doesNotMatch(accountPage, /AccountStudentsBetaClient/);
  assert.doesNotMatch(accountPage, /beta\/cuenta/);
});
