import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("school impact report queries remain scoped to the requested school", () => {
  const source = read("lib/reports/school-impact-report.ts");
  for (const table of ["schools", "listings", "profiles", "user_roles", "agreements"]) {
    const start = source.indexOf(`.from("${table}")`);
    assert.ok(start !== -1, `missing ${table} query`);
    const fragment = source.slice(start, start + 500);
    assert.match(fragment, /\.eq\("school_id", schoolId\)|\.eq\("id", schoolId\)/, `${table} must be school-scoped`);
  }
  assert.match(source, /\.in\("listing_id", listingIds\)/);
  assert.match(source, /listingById\.has\(agreement\.listing_id\)/);
});

test("school PDF route denies exports for inactive centres", () => {
  const source = read("app/api/school/impact-report/route.ts");
  assert.match(source, /school\.is_active === false/);
  assert.match(source, /status: 403/);
  assert.ok(source.indexOf("school.is_active === false") < source.indexOf("loadSchoolImpactReport({"));
});

test("school admin sees only their own report delivery history", () => {
  const source = read("app/admin/school/page.tsx");
  const start = source.indexOf('.from("school_impact_report_deliveries")');
  assert.ok(start !== -1);
  const query = source.slice(start, start + 450);
  assert.match(query, /\.eq\("school_id", effectiveSchoolId\)/);
  assert.match(query, /\.eq\("user_id", user\.id\)/);
});
