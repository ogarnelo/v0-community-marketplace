import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("only verified signup confirmation triggers nonblocking admin alert", () => {
  const callback = read("app/auth/callback/route.ts");
  const form = read("components/auth/auth-form.tsx");
  assert.match(callback, /isSignupConfirmation[\s\S]*after\(\(\) => notifySuperadminsOfConfirmedSignup/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.doesNotMatch(form, /notifySuperadminsOfConfirmedSignup/);
  assert.match(callback, /NextResponse.redirect/);
});

test("admin signup mail uses superadmin role and excludes new user's identity", () => {
  const email = read("lib/emails/signup-admin-alert.ts");
  assert.match(email, /eq\("role", "super_admin"\)/);
  assert.match(email, /Promise\.allSettled/);
  assert.match(email, /idempotencyKey/);
  assert.match(email, /sendBrandedEmail/);
  assert.doesNotMatch(email, /params\.(email|name|phone|schoolId|postalCode)/);
  assert.match(email, /catch \(error\)/);
});
