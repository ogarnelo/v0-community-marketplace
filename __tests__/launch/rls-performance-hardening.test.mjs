import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260918001500_optimize_mvp_rls.sql", import.meta.url),
  "utf8"
);

test("MVP RLS policies use statement-stable auth uid checks", () => {
  assert.match(migration, /\(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /with check \(auth\.uid\(\)/);
});

test("historical duplicate MVP policies are removed", () => {
  assert.match(migration, /drop policy if exists "Users can manage their favorites"/);
  assert.match(migration, /drop policy if exists "Users can send messages"/);
  assert.match(migration, /drop policy if exists "Users can create own saved searches"/);
  assert.match(migration, /drop policy if exists "Reviews are visible to everyone"/);
});

test("authorized read paths are consolidated instead of broadened", () => {
  assert.match(migration, /reports_select_authorized/);
  assert.match(migration, /saved_searches_select_authorized/);
  assert.match(migration, /user_roles_select_authorized/);
  assert.match(migration, /demand_match_notifications_select_authorized/);
  assert.match(migration, /public\.is_superadmin\(\)/);
});

test("duplicate active indexes are removed safely", () => {
  assert.match(migration, /drop constraint if exists favorites_user_id_listing_id_key/);
  assert.match(migration, /drop index if exists public\.saved_searches_user_id_created_at_idx/);
});
