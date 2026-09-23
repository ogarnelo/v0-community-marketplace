import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/admin/super/users/page.tsx", "utf8");

test("super admin users page scopes navbar data to the page request", () => {
  const helperStart = source.indexOf("async function listAllAuthUsers()");
  const pageStart = source.indexOf("export default async function SuperAdminUsersPage()");
  assert.ok(helperStart >= 0 && pageStart > helperStart);

  const helper = source.slice(helperStart, pageStart);
  const page = source.slice(pageStart);

  assert.doesNotMatch(helper, /getNavbarData\(supabase\)/);
  assert.match(page, /const supabase = await createClient\(\)/);
  assert.match(page, /const navbarData = await getNavbarData\(supabase\)/);
  assert.match(page, /<Navbar \{\.\.\.navbarData\} \/>/);
});

test("auth user listing uses only the admin client it creates locally", () => {
  const helperStart = source.indexOf("async function listAllAuthUsers()");
  const pageStart = source.indexOf("export default async function SuperAdminUsersPage()");
  const helper = source.slice(helperStart, pageStart);

  assert.match(helper, /const admin = createAdminClient\(\)/);
  assert.match(helper, /admin\.auth\.admin\.listUsers/);
  assert.doesNotMatch(helper, /\bsupabase\b/);
});
