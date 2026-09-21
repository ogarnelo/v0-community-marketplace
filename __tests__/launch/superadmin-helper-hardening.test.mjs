import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260921213000_move_superadmin_helper_private.sql", import.meta.url),
  "utf8"
);

test("superadmin privileged lookup lives outside the exposed public schema", () => {
  assert.match(migration, /create schema if not exists private/);
  assert.match(migration, /function private\.is_superadmin\(\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /revoke all on schema private from public/);
});

test("public compatibility helper no longer runs as security definer", () => {
  assert.match(
    migration,
    /function public\.is_superadmin\(\)[\s\S]*security invoker[\s\S]*select private\.is_superadmin\(\)/
  );
  assert.doesNotMatch(
    migration,
    /function public\.is_superadmin\(\)[\s\S]*security definer/
  );
});

test("anonymous callers cannot execute either helper", () => {
  assert.match(migration, /revoke all on function private\.is_superadmin\(\) from anon/);
  assert.match(migration, /revoke all on function public\.is_superadmin\(\) from anon/);
});
