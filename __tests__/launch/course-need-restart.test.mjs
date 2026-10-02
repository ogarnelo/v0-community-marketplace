import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const helper = readFileSync("lib/my-course/course-need-restart-server.ts", "utf8");
const route = readFileSync("app/api/my-course/needs/[id]/restart/route.ts", "utf8");
const client = readFileSync("components/my-course/my-course-client.tsx", "utf8");
const history = readFileSync("lib/my-course/course-need-history-server.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("restart keeps the fulfilled row immutable and creates a new active cycle", () => {
  assert.match(helper, /\.eq\("status", "fulfilled"\)/);
  assert.match(helper, /\.eq\("owner_user_id", userId\)/);
  assert.match(helper, /createCourseNeed\(userId/);
  assert.match(helper, /activateCourseNeedSearch\(userId, activeNeed\.id\)/);
  assert.match(helper, /previous_demand_request_id: source\.demand_request_id/);
  assert.doesNotMatch(helper, /status:\s*"active"[\s\S]*fulfilledNeedId/);
});

test("restart is idempotent when an equivalent active need already exists", () => {
  assert.match(helper, /error\.code !== "need_exists"/);
  assert.match(helper, /findEquivalentActiveNeed/);
  assert.match(helper, /\.eq\("academic_year", student\.academic_year\)/);
  assert.match(helper, /reused_existing: !created/);
});

test("restart compensates a newly created need if search activation fails", () => {
  assert.match(helper, /if \(created\)/);
  assert.match(helper, /archiveCourseNeed\(userId, activeNeed\.id\)/);
  assert.match(helper, /Cleanup must not hide the original failure/);
});

test("restart route requires a confirmed authenticated account", () => {
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /email_confirmed_at/);
  assert.match(route, /restartFulfilledCourseNeed\(user\.id, id\)/);
  assert.match(route, /search_active: true/);
});

test("Conseguidos exposes Volver a buscar and immediately reflects an active retry", () => {
  assert.match(client, /sameNeedIdentity/);
  assert.match(client, /\/api\/my-course\/needs\/".*\/restart/);
  assert.match(client, /Volver a buscar/);
  assert.match(client, /Buscando de nuevo/);
  assert.match(client, /reused_existing/);
  assert.match(history, /\.eq\("status", "fulfilled"\)/);
});

test("course-need restart is part of critical prebuild contracts", () => {
  assert.equal(
    pkg.scripts["test:course-need-restart"],
    "node --test __tests__/launch/course-need-restart.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:course-need-restart/);
});
