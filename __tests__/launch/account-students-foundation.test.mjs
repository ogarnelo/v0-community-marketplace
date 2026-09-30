import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260927213955_account_students_foundation_phase_a.sql",
  "utf8"
);
const accountPage = readFileSync("app/account/page.tsx", "utf8");

test("Phase A creates only the new account_students table", () => {
  assert.match(migration, /create table if not exists public\.account_students/);
  assert.match(migration, /owner_user_id uuid not null references public\.profiles/);
  assert.match(migration, /relationship in \('self', 'guardian'\)/);
  assert.match(migration, /alias text/);
  assert.match(migration, /school_id uuid references public\.schools\(id\) on delete set null/);
  assert.match(migration, /grade_level text not null/);
  assert.match(migration, /academic_year text not null/);

  assert.doesNotMatch(migration, /alter table public\.profiles/);
  assert.doesNotMatch(migration, /alter table public\.saved_searches/);
  assert.doesNotMatch(migration, /alter table public\.demand_requests/);
  assert.doesNotMatch(migration, /alter table public\.listings/);
  assert.doesNotMatch(migration, /alter table public\.conversations/);
  assert.doesNotMatch(migration, /alter table public\.agreements/);
  assert.doesNotMatch(migration, /insert into public\.account_students/);
  assert.doesNotMatch(migration, /update public\./);
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

test("account integration keeps the production account shell and never uses the old beta account UI", () => {
  assert.match(accountPage, /AccountStudentsSection/);
  assert.match(accountPage, /AccountProfileForm/);
  assert.match(accountPage, /quickActions\.map/);
  assert.doesNotMatch(accountPage, /AccountStudentsBetaClient/);
  assert.doesNotMatch(accountPage, /beta\/cuenta/);
});
