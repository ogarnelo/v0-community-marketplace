import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const metrics = read("lib/admin/liquidity-metrics.ts");
const page = read("app/admin/super/liquidity/page.tsx");
const superPage = read("app/admin/super/page.tsx");
const demandPage = read("app/admin/super/demand/page.tsx");

test("liquidity cockpit exposes raw funnel metrics without arbitrary score", () => {
  assert.match(page, /Search Success/);
  assert.match(page, /Need → Contact/);
  assert.match(page, /Contact → Agreement/);
  assert.match(page, /NR7/);
  assert.match(page, /NR14/);
  assert.match(page, /T\. contacto/);
  assert.match(page, /T\. acuerdo/);
  assert.match(page, /Supply B1/);
  assert.doesNotMatch(page, /Liquid School score|0-100|liquidity score/i);
});

test("liquidity metrics keep zero denominators unknown and flag small samples", () => {
  assert.match(metrics, /rate: denominator > 0 \? numerator \/ denominator : null/);
  assert.match(metrics, /denominator > 0 && denominator < 5/);
  assert.match(page, /sin muestra/);
  assert.match(page, /muestra baja/);
});

test("dashboard supports requested segmentation and period filters", () => {
  assert.match(page, /name="period"/);
  assert.match(page, /name="school"/);
  assert.match(page, /name="category"/);
  assert.match(page, /name="grade"/);
  assert.match(page, /name="isbn"/);
  assert.match(metrics, /schoolId/);
  assert.match(metrics, /category/);
  assert.match(metrics, /gradeLevel/);
  assert.match(metrics, /isbn/);
});

test("NR14 is based on confirmed resolution timing and B1 supply is attributed from actions", () => {
  assert.match(metrics, /daysBetween\(need\.created_at, need\.resolved_at\)/);
  assert.match(metrics, /days <= 14/);
  assert.match(metrics, /resulting_listing_id/);
  assert.match(metrics, /activatedSellerToListing/);
});

test("liquidity cockpit is linked from primary admin surfaces", () => {
  assert.match(superPage, /\/admin\/super\/liquidity/);
  assert.match(demandPage, /\/admin\/super\/liquidity/);
});
