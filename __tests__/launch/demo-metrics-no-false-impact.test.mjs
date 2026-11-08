import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20261108180000_listings_demo_reporting_flag.sql");
const detection = read("lib/seo/demo-listing.ts");
const superReport = read("lib/reports/super-admin-report.ts");
const schoolReport = read("lib/reports/school-impact-report.ts");
const mvp = read("app/admin/super/mvp/page.tsx");
const liquidity = read("app/admin/super/liquidity/page.tsx");
const superPage = read("app/admin/super/page.tsx");

test("demo identification is derived, not editable by a user", () => {
  assert.match(migration, /GENERATED ALWAYS AS/);
  assert.match(migration, /STORED/);
  assert.match(migration, /d0000000-0000-4000-8000-%/);
  assert.match(migration, /demo\[\[:space:\]\]\*/i);
  assert.match(detection, /DEMO_ID_PREFIX/);
  assert.match(detection, /\^demo/);
  assert.match(migration, /WHERE is_demo = false/);
  assert.doesNotMatch(migration, /UPDATE|DELETE|INSERT INTO/i);
});

test("global impact excludes demo completed deals and demo active listings", () => {
  assert.match(superReport, /\.eq\("is_demo", false\)/);
  assert.match(superReport, /const realAgreements = agreements\.filter/);
  assert.match(superReport, /confirmedReuses: realAgreements\.length/);
  assert.match(superReport, /const circularValue = realAgreements\.reduce/);
  assert.match(superReport, /unquantifiedItems: Math\.max\(0, realAgreements\.length/);
});

test("school reports exclude demo listings and their agreements", () => {
  assert.match(schoolReport, /\.eq\("is_demo", false\)/);
  assert.match(schoolReport, /listingById\.has\(agreement\.listing_id\)/);
});

test("admin pilot and liquidity dashboards exclude demo funnels", () => {
  assert.match(mvp, /\.eq\("is_demo", false\)/);
  assert.match(mvp, /realListingIds/);
  assert.match(mvp, /realConversationIds/);
  assert.match(liquidity, /\.eq\("is_demo", false\)/);
  assert.match(liquidity, /realListingIds\.has\(row\.listing_id\)/);
  assert.match(superPage, /\.eq\("is_demo", false\)/);
});

test("moderation queue remains visible; no incident is created by a reporting fix", () => {
  assert.match(mvp, /const reports = reportsResult\.data \|\| \[\]/);
  assert.doesNotMatch(migration, /reports|agreements|school_directory/);
});
