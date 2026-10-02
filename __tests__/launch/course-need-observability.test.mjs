import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync("lib/admin/course-need-observability.ts", "utf8");
const page = readFileSync("app/admin/super/demand/page.tsx", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("course-need observability reads only the existing stable demand/search links", () => {
  assert.match(helper, /from\("course_needs"\)/);
  assert.match(helper, /from\("demand_requests"\)/);
  assert.match(helper, /eq\("source", "course_need"\)/);
  assert.match(helper, /from\("saved_searches"\)/);
  assert.match(helper, /eq\("intent_source", "course_need"\)/);
  assert.match(helper, /demand_request_id/);
  assert.doesNotMatch(helper, /insert\(|update\(|delete\(/);
});

test("course-need observability exposes the operational funnel and drift detector", () => {
  assert.match(helper, /activated:/);
  assert.match(helper, /searching/);
  assert.match(helper, /withResult/);
  assert.match(helper, /paused/);
  assert.match(helper, /resolved/);
  assert.match(helper, /archived/);
  assert.match(helper, /inconsistent/);
  assert.match(helper, /demand\.status === "open" \|\| demand\.status === "matched"/);
  assert.match(helper, /demand\.status === "dismissed"/);
  assert.match(helper, /notifications_enabled/);
});

test("super-admin demand page renders Mi curso Buscar por mí observability", () => {
  assert.match(page, /loadCourseNeedObservability/);
  assert.match(page, /Mi curso · Buscar por mí/);
  assert.match(page, /Activadas/);
  assert.match(page, /Buscando ahora/);
  assert.match(page, /Con resultado/);
  assert.match(page, /Pausadas/);
  assert.match(page, /Acuerdo confirmado/);
  assert.match(page, /Archivadas/);
  assert.match(page, /Inconsistencias/);
});

test("course-need observability is part of the critical prebuild contracts", () => {
  assert.equal(
    pkg.scripts["test:course-need-observability"],
    "node --test __tests__/launch/course-need-observability.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:course-need-observability/);
});
