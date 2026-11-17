import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("manual and scheduled school report endpoints reject unverified or third-party email", () => {
  for (const path of [
    "app/api/school/send-impact-report/route.ts",
    "app/api/school/report-subscription/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /user\.email_confirmed_at/);
    assert.match(source, /email !== verifiedEmail/);
    assert.match(source, /status: 403/);
  }
});

test("cron rechecks verified recipient and current school role for legacy subscriptions", () => {
  const source = read("app/api/cron/school-impact-reports/route.ts");
  assert.match(source, /admin\.auth\.admin\.getUserById\(subscription\.user_id\)/);
  assert.match(source, /account\?\.user\?\.email_confirmed_at/);
  assert.match(source, /subscription\.email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(source, /\.eq\("school_id", subscription\.school_id\)/);
  assert.match(source, /\.eq\("role", "school_admin"\)/);
});

test("school report recipient field is non-editable", () => {
  const source = read("components/admin/school-admin-dashboard.tsx");
  assert.match(source, /const monthlyEmail = currentUserEmail/);
  assert.match(source, /readOnly/);
  assert.doesNotMatch(source, /setMonthlyEmail/);
});
