import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const criticalFiles = [
  "scripts/launch-final-qa.mjs",
  "scripts/apply-launch-final-qa-scripts.mjs",
  "app/api/launch/final-check/route.ts",
  "app/admin/super/launch/page.tsx",
  "app/admin/super/layout.tsx",
];

test("final launch critical files exist", () => {
  for (const file of criticalFiles) {
    assert.ok(fs.existsSync(file), `${file} should exist before launch`);
  }
});

test("final launch routes keep default exports where required", () => {
  for (const file of ["app/admin/super/launch/page.tsx", "app/admin/super/layout.tsx"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /export\s+default/, `${file} should have a default export`);
  }
});

test("final launch protected endpoints keep authorization checks", () => {
  const route = fs.readFileSync("app/api/launch/final-check/route.ts", "utf8");
  assert.match(route, /LAUNCH_HEALTH_SECRET|hasValidAutomationSecret|Unauthorized/i);
});

test("final QA fails if logged-out admin pages expose private content", () => {
  const source = fs.readFileSync("scripts/launch-final-qa.mjs", "utf8");
  assert.match(source, /Admin routes must not expose private content while logged out/);
  assert.match(source, /isRedirectToAuth/);
  assert.match(source, /\/admin\/super\/transaction-velocity/);
});
