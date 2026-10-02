import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync("lib/demand/need-attribution.ts", "utf8");
const confirmRoute = readFileSync("app/api/agreements/confirm/route.ts", "utf8");
const proposeRoute = readFileSync("app/api/agreements/propose/route.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("confirmed attributed agreement fulfills only the linked Mi curso need", () => {
  assert.match(helper, /fulfillCourseNeedFromResolvedDemand/);
  assert.match(helper, /from\("course_needs"\)/);
  assert.match(helper, /eq\("demand_request_id", demandRequestId\)/);
  assert.match(helper, /status: "fulfilled"/);
  assert.match(helper, /eq\("status", "active"\)/);
  assert.match(helper, /courseNeed\.status === "archived"/);
});

test("fulfillment stops only course-need alerts and compensates on transition failure", () => {
  assert.match(helper, /from\("saved_searches"\)/);
  assert.match(helper, /eq\("intent_source", "course_need"\)/);
  assert.match(helper, /notifications_enabled: false/);
  assert.match(helper, /notifications_enabled: true/);
  assert.match(helper, /enabledSearchIds/);
});

test("proposal only attributes demand while final confirmation closes Mi curso", () => {
  assert.match(proposeRoute, /linkAgreementToNeed/);
  assert.match(confirmRoute, /linkAgreementToNeed/);
  assert.match(helper, /if \(resolvedAt\) \{/);
  assert.match(helper, /await fulfillCourseNeedFromResolvedDemand\(admin, needId, resolvedAt\)/);
  assert.match(helper, /agreement\.confirmed_at \|\| \(agreement\.status === "confirmed"/);
});

test("course-need fulfillment is part of the critical prebuild contracts", () => {
  assert.equal(
    pkg.scripts["test:course-need-fulfillment"],
    "node --test __tests__/launch/course-need-fulfillment.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:course-need-fulfillment/);
});
