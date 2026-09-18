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


const followupMigration = readFileSync(
  new URL("../../supabase/migrations/20260918062000_optimize_active_rls_initplans.sql", import.meta.url),
  "utf8"
);

test("remaining active admin and marketplace RLS helpers are statement-stable", () => {
  assert.match(followupMigration, /\(select public\.is_superadmin\(\)\)/);
  assert.match(followupMigration, /marketplace_search_events_admin_read/);
  assert.match(followupMigration, /school_registration_requests_select_superadmin/);
  assert.match(followupMigration, /support_tickets_select_superadmin/);
  assert.match(followupMigration, /user_marketplace_preferences/);
  assert.match(followupMigration, /\(select auth\.uid\(\)\)/);
});


const demandMigration = readFileSync(
  new URL("../../supabase/migrations/20260918194500_optimize_active_demand_rls.sql", import.meta.url),
  "utf8"
);

test("active Demand Intelligence RLS uses statement-stable auth checks", () => {
  assert.match(demandMigration, /Super admins can manage demand campaigns/);
  assert.match(demandMigration, /Users can insert own demand events/);
  assert.match(demandMigration, /Users can read own demand requests/);
  assert.match(demandMigration, /Super admins can manage moderation flags/);
  assert.match(demandMigration, /\(select auth\.uid\(\)\)/);
});

test("active Demand Intelligence foreign keys have dedicated indexes", () => {
  assert.match(demandMigration, /demand_campaigns_created_by_idx/);
  assert.match(demandMigration, /demand_events_user_id_idx/);
  assert.match(demandMigration, /demand_events_school_id_idx/);
  assert.match(demandMigration, /demand_requests_user_id_idx/);
  assert.match(demandMigration, /demand_requests_school_id_idx/);
});
