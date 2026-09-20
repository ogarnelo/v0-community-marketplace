import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guard = readFileSync("components/auth/session-inactivity-guard.tsx", "utf8");
const route = readFileSync("app/api/auth/session-policy/route.ts", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

test("session inactivity policy is role-aware", () => {
  assert.match(route, /ADMIN_TIMEOUT_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(route, /USER_TIMEOUT_MS = 8 \* 60 \* 60 \* 1000/);
  assert.match(route, /super_admin/);
  assert.match(route, /school_admin/);
  assert.match(route, /admin-2h/);
  assert.match(route, /user-8h/);
});

test("inactivity guard persists activity across refreshes and signs out locally", () => {
  assert.match(guard, /wetudy:last-activity:/);
  assert.match(guard, /window\.localStorage/);
  assert.match(guard, /Date\.now\(\) - lastActivity >= timeoutMs/);
  assert.match(guard, /signOut\(\{ scope: "local" \}\)/);
  assert.match(guard, /\/auth\?reason=inactive/);
  assert.match(guard, /visibilitychange/);
  assert.match(guard, /storage/);
});

test("inactivity guard runs globally", () => {
  assert.match(layout, /SessionInactivityGuard/);
  assert.match(layout, /<SessionInactivityGuard \/>/);
});
