import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(p, "utf8");
const join = read("app/onboarding/join-school/page.tsx");
const auth = read("components/auth/auth-form.tsx");
const onboardingPage = read("app/onboarding/students/page.tsx");
const onboardingForm = read("components/onboarding/account-students-onboarding.tsx");
const admin = read("app/admin/school/page.tsx");
const superAdmin = read("app/admin/super/page.tsx");
const safeNext = read("lib/auth/safe-next.ts");

test("QR selects an active centre and writes only the authenticated user's profile", () => {
  assert.match(join, /const activeSchool = await resolveSchoolFromId\(school\.id\)/);
  assert.match(join, /const \{ error: profileError \} = await supabase\.from\("profiles"\)\.upsert\([\s\S]*?id: user\.id,[\s\S]*?school_id: activeSchool\.id/);
  assert.match(join, /const \{ error: authError \} = await supabase\.auth\.updateUser\(/);
  assert.match(join, /school_id: activeSchool\.id/);
  assert.match(join, /if \(!user\)\s*\{\s*throw new Error\("Debes iniciar sesión para vincular el centro\."/);
  assert.doesNotMatch(join, /\.from\("user_roles"\)/);
  assert.doesNotMatch(join, /\.rpc\("grant_|\.rpc\("set_school_admin/);
});

test("QR return path survives login and optional student onboarding", () => {
  assert.match(join, /\/auth\?mode=login&next=\$\{encodeURIComponent\(/);
  assert.match(join, /\/onboarding\/join-school\?school=\$\{found\.id\}&join=1/);
  assert.match(auth, /getSafeInternalPath\(searchParams\.get\("next"\)\)/);
  assert.match(auth, /let destination = nextPath \|\| "\/account"/);
  assert.match(auth, /\`\/onboarding\/students\?next=\$\{encodeURIComponent\(nextPath\)\}\`/);
  assert.match(onboardingPage, /getSafeInternalPath\(requestedNext\)/);
  assert.match(onboardingPage, /nextPath=\{safeNext\}/);
  assert.match(onboardingForm, /router\.push\(nextPath \|\| "\/marketplace"\)/);
  assert.match(join, /if \(params\.get\("join"\) !== "1"\) return/);
  assert.match(join, /await linkCurrentUserToSchool\(found\)/);
  assert.match(join, /router\.replace\("\/marketplace\?joined=1"\)/);
  assert.match(safeNext, /INTERNAL_ORIGIN/);
  assert.match(safeNext, /value\.startsWith\("\/\/"\)/);
});

test("family-selected school never determines school admin or superadmin access", () => {
  assert.match(admin, /\.from\("user_roles"\)\.select\("role, school_id"\)/);
  assert.match(admin, /role\.role === "school_admin" && Boolean\(role\.school_id\)/);
  assert.match(admin, /effectiveSchoolId = schoolAdminRole\?\.school_id \|\| null/);
  assert.match(admin, /if \(!effectiveSchoolId\)/);
  assert.match(admin, /redirect\("\/"\)/);
  assert.match(superAdmin, /\.from\("user_roles"\)/);
  assert.match(superAdmin, /\.eq\("role", "super_admin"\)/);
  assert.match(superAdmin, /redirect\("\/"\)/);
  assert.doesNotMatch(admin, /effectiveSchoolId = profile\?\.school_id/);
});
