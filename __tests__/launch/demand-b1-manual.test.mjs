import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const helper = read("lib/admin/demand-opportunities.ts");
const migration = read("supabase/migrations/20260924133000_demand_b1_manual_activation.sql");

test("B1 reuses existing demand campaign/action infrastructure", () => {
  assert.match(helper, /demand_campaigns/);
  assert.match(helper, /demand_opportunity_actions/);
  assert.doesNotMatch(migration, /create table[^;]*demand_opportunities/i);
  assert.match(migration, /demand_campaigns_opportunity_key_uidx/);
});

test("opportunity grouping is deterministic and ISBN-first", () => {
  assert.match(helper, /createHash\("sha256"\)/);
  assert.match(helper, /normalizeIsbn/);
  assert.match(helper, /isbn:\$\{canonical\}/);
  assert.match(helper, /queryTokens/);
  assert.match(helper, /school:/);
});

test("candidate search excludes students, demanders and recently contacted users", () => {
  assert.match(helper, /profile\.user_type === "student"/);
  assert.match(helper, /demanders\.has\(sellerId\)/);
  assert.match(helper, /recentlyContacted\.has\(sellerId\)/);
  assert.match(helper, /sameIsbn/);
  assert.match(helper, /sameSchoolCategory/);
  assert.match(helper, /reasons/);
});

test("manual activation fields are added without email automation", () => {
  assert.match(migration, /target_user_id/);
  assert.match(migration, /resulting_listing_id/);
  assert.match(migration, /responded_at/);
  assert.doesNotMatch(helper, /sendEmail|Resend|campaign email/i);
});
