import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("superadmin access uses database roles instead of a hardcoded email bypass", () => {
  const roles = read("lib/admin/roles.ts");
  const superPage = read("app/admin/super/page.tsx");
  const usersPage = read("app/admin/super/users/page.tsx");
  const schoolsPage = read("app/admin/super/schools/page.tsx");
  const demandPage = read("app/admin/super/demand/page.tsx");
  const mvpPage = read("app/admin/super/mvp/page.tsx");
  const adminLogin = read("components/admin/admin-login-form.tsx");

  for (const source of [roles, superPage, usersPage, schoolsPage, demandPage, mvpPage, adminLogin]) {
    assert.doesNotMatch(source, /oscar_garnelo@hotmail\.com/);
  }

  assert.match(roles, /hasSuperAdminRole/);
  assert.match(superPage, /eq\("role", "super_admin"\)/);
  assert.match(usersPage, /eq\("role", "super_admin"\)/);
  assert.match(schoolsPage, /eq\("role", "super_admin"\)/);
});

test("launch security migration makes demand views invoker-safe and locks legacy RLS tables", () => {
  const migration = read("supabase/migrations/20260917220500_launch_security_hardening.sql");

  assert.match(migration, /marketplace_demand_summary set \(security_invoker = true\)/);
  assert.match(migration, /saved_search_demand_summary set \(security_invoker = true\)/);
  assert.match(migration, /where ur\.user_id = auth\.uid\(\)[\s\S]*ur\.role = 'super_admin'/);
  assert.doesNotMatch(migration, /oscar_garnelo@hotmail\.com/);
  assert.match(migration, /legacy_locked_/);
});

test("viewport diagnostics are explicit, authenticated and opt-in", () => {
  const navbar = read("components/navbar.tsx");
  const route = read("app/api/debug/viewport/route.ts");

  assert.match(navbar, /viewport_debug/);
  assert.match(navbar, /wetudyViewportDebug/);
  assert.match(navbar, /visualViewport/);
  assert.match(route, /eq\("role", "super_admin"\)/);
  assert.match(route, /\[viewport-debug\]/);
});
