import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("profiles migration adds first and last name fields", () => {
  const migration = read("supabase/migrations/20260916205500_profiles_first_last_name.sql");
  assert.match(migration, /add column if not exists first_name text/);
  assert.match(migration, /add column if not exists last_name text/);
  assert.match(migration, /Best-effort backfill/);
});

test("signup stores given name and surnames separately", () => {
  const source = read("components/auth/auth-form.tsx");
  assert.match(source, /first_name: normalizedFirstName/);
  assert.match(source, /last_name: normalizedLastName/);
  assert.match(source, /autoComplete="given-name"/);
  assert.match(source, /autoComplete="family-name"/);
});

test("account profile edits both name fields without dropping full_name compatibility", () => {
  const source = read("components/account/account-profile-form.tsx");
  assert.match(source, /first_name: normalizedFirstName/);
  assert.match(source, /last_name: normalizedLastName/);
  assert.match(source, /full_name: normalizedFullName/);
});

test("superadmin reads the dedicated name columns", () => {
  const source = read("app/admin/super/users/page.tsx");
  assert.match(source, /select\("id, first_name, last_name, full_name, school_id, created_at"\)/);
  assert.match(source, /profile\?\.first_name/);
  assert.match(source, /profile\?\.last_name/);
});
