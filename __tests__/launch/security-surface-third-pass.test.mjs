import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("legacy payment review endpoint is closed with the rest of commerce during MVP", () => {
  const route = read("app/api/reviews/create/route.ts");

  assert.match(route, /isLegacyCommerceEnabled/);
  assert.match(route, /status: 404/);
});

test("demand analytics cannot be anonymously poisoned", () => {
  const route = read("app/api/marketplace/search-events/route.ts");

  assert.match(route, /auth_required_for_analytics/);
  assert.match(route, /user_id: user\.id/);
  assert.match(route, /source_path: "\/marketplace"/);
  assert.doesNotMatch(route, /user_id: user\?\.id \|\| null/);
});

test("donation school scope comes from the listing, never from client input", () => {
  const route = read("app/api/donations/request/route.ts");
  const service = read("lib/services/donations.service.ts");

  assert.doesNotMatch(route, /body\?\.schoolId/);
  assert.match(route, /slice\(0, 500\)/);
  assert.match(service, /school_id: listing\.school_id \|\| null/);
  assert.doesNotMatch(service, /schoolId \|\| listing\.school_id/);
});

test("user_roles gets an explicit primary key without changing role uniqueness rules", () => {
  const migration = read("supabase/migrations/20260918063500_user_roles_primary_key.sql");

  assert.match(migration, /add column if not exists id uuid default gen_random_uuid\(\)/);
  assert.match(migration, /primary key \(id\)/);
  assert.doesNotMatch(migration, /drop index/);
});
