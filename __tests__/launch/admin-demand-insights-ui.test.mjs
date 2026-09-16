import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/admin/super/demand/page.tsx", "utf8");

test("admin demand page uses actionable insight helpers", () => {
  assert.match(page, /buildDemandInsights/);
  assert.match(page, /buildDemandActionLabel/);
  assert.match(page, /Prioridades accionables/);
});

test("admin demand priorities focus on zero-result demand", () => {
  assert.match(page, /filter\(\(insight\) => insight\.zeroResults > 0\)/);
  assert.match(page, /insight\.zeroResults/);
  assert.match(page, /insight\.searches/);
  assert.match(page, /formatDate\(insight\.lastSeenAt\)/);
});
