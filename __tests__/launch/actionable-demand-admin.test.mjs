import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const helper = readFileSync("lib/admin/demand-insights.ts", "utf8");
const docs = readFileSync("docs/ACTIONABLE_DEMAND_ADMIN_V1.md", "utf8");

test("demand insights cover actionable buckets", () => {
  assert.match(helper, /kind: \"query\" \| \"isbn\" \| \"category\" \| \"grade\"/);
  assert.match(helper, /buildDemandInsights/);
  assert.match(helper, /zeroResults/);
});

test("demand insights expose admin action labels", () => {
  assert.match(helper, /Crear campaña/);
  assert.match(helper, /Pedir este ISBN/);
  assert.match(helper, /Reforzar categoría/);
  assert.match(helper, /Reforzar curso/);
});

test("admin demand scope avoids public commerce changes", () => {
  assert.match(docs, /No automatic campaigns/);
  assert.match(docs, /No checkout/);
  assert.doesNotMatch(docs, /Apple Pay|Correos/i);
});
