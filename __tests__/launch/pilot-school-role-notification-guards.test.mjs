import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("notification recipients can only update their own read timestamp", () => {
  const migration = read("supabase/migrations/20261108190000_notifications_read_at_only.sql");
  assert.match(migration, /REVOKE UPDATE ON TABLE public\.notifications FROM authenticated/);
  assert.match(migration, /GRANT UPDATE \(read_at\) ON TABLE public\.notifications TO authenticated/);
  assert.doesNotMatch(migration, /DISABLE ROW LEVEL SECURITY|DROP POLICY|GRANT UPDATE ON TABLE .* TO anon/i);
});

test("mark-as-read routes use only read_at and scope by authenticated recipient", () => {
  for (const path of ["app/api/notifications/read/route.ts", "app/api/notifications/read-all/route.ts"]) {
    const route = read(path);
    assert.match(route, /supabase\.auth\.getUser\(\)/);
    assert.match(route, /\.update\(\{ read_at: new Date\(\)\.toISOString\(\) \}\)/);
    assert.match(route, /\.eq\("user_id", user\.id\)/);
    assert.doesNotMatch(route, /createAdminClient|\.update\(\{\s*(user_id|kind|title|body|metadata|href):/);
  }
});

test("school invitation issuance and role mutation require administrator role", () => {
  const qr = read("app/api/school/share-qr/route.ts");
  const toggle = read("app/api/admin/toggle-school-active/route.ts");
  assert.match(qr, /role === "school_admin" && role\.school_id/);
  assert.match(toggle, /\.eq\("role", "super_admin"\)/);
  assert.match(toggle, /!roles\?\.length/);
});
