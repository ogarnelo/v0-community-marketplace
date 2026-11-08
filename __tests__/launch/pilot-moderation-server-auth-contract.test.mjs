import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/admin/reports/status/route.ts", "utf8");
const page = readFileSync("app/admin/super/reports/[id]/page.tsx", "utf8");
const controls = readFileSync("components/admin/report-status-controls.tsx", "utf8");

test("moderation POST binds actor to authenticated server session", () => {
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /if \(!user\)/);
  assert.match(route, /\.from\("user_roles"\)[\s\S]*?\.eq\("user_id", user\.id\)[\s\S]*?\.eq\("role", "super_admin"\)/);
  assert.match(route, /if \(roleError \|\| !roles\?\.length\)/);
  assert.match(route, /p_actor_id:\s*user\.id/);
  assert.doesNotMatch(route, /p_actor_id:\s*(body|request|payload)\b/);
});

test("moderation POST checks permissions before privileged RPC and validates inputs", () => {
  const guardAt = route.indexOf("if (roleError || !roles?.length)");
  const adminAt = route.indexOf("const admin = createAdminClient()");
  assert.ok(guardAt >= 0 && adminAt > guardAt);
  assert.match(route, /VALID_STATUSES = new Set\(\["open", "reviewing", "resolved", "dismissed"\]\)/);
  assert.match(route, /resolutionNote\.trim\(\)\.slice\(0, 1000\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /status: 403/);
  assert.match(route, /status: 400/);
});

test("report detail restricts privileged report reads to superadmin", () => {
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  const roleAt = page.indexOf('.eq("role", "super_admin")');
  const readAt = page.indexOf('admin.from("reports")');
  assert.ok(roleAt >= 0 && readAt > roleAt);
  assert.match(page, /if \(!roles\?\.length\) redirect\("\/"\)/);
});

test("moderation UI submits authenticated same-origin status and note only", () => {
  assert.match(controls, /fetch\("\/api\/admin\/reports\/status"/);
  assert.match(controls, /method: "POST"/);
  assert.match(controls, /reportId,\s*status: nextStatus,\s*resolutionNote:/);
  assert.doesNotMatch(controls, /p_actor_id|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
