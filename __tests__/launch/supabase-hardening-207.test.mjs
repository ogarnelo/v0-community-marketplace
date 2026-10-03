import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261003071831_hardening_fk_indexes_rls_initplan.sql",
  "utf8"
);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("hardening migration removes the duplicate payment-intent index", () => {
  assert.match(migration, /drop index if exists public\.payment_intents_offer_idx/);
  assert.doesNotMatch(migration, /drop index if exists public\.payment_intents_offer_id_idx/);
});

test("hardening migration adds covering indexes for all previously unindexed foreign keys", () => {
  const expected = [
    "automation_runs_triggered_by_idx",
    "autopilot_recommendations_resolved_by_idx",
    "business_metrics_snapshots_business_id_idx",
    "conversation_outcome_feedback_user_id_idx",
    "course_materials_created_by_idx",
    "demand_requests_confirmed_agreement_id_idx",
    "demand_requests_conversation_id_idx",
    "demand_requests_matched_listing_id_idx",
    "inventory_expansion_events_target_listing_id_idx",
    "listing_boosts_user_id_idx",
    "listing_offer_events_actor_id_idx",
    "listing_packs_seller_id_idx",
    "referrals_referrer_id_idx",
    "reports_resolved_by_idx",
    "school_admins_user_id_idx",
    "school_codes_school_id_idx",
    "seo_programmatic_pages_reviewed_by_idx",
    "transaction_issues_conversation_id_idx",
    "transaction_issues_listing_id_idx",
    "transaction_velocity_events_conversation_id_idx",
    "transaction_velocity_events_payment_intent_id_idx",
    "user_follows_following_id_idx",
  ];

  for (const index of expected) {
    assert.match(migration, new RegExp("create index if not exists " + index));
  }
});

test("hardening migration optimizes auth.uid evaluation without widening policy access", () => {
  assert.match(migration, /alter policy %I on %I\.%I/);
  assert.match(migration, /replace\(p\.qual, 'auth\.uid\(\)', '\(select auth\.uid\(\)\)'\)/);
  assert.match(migration, /replace\(p\.with_check, 'auth\.uid\(\)', '\(select auth\.uid\(\)\)'\)/);
  assert.doesNotMatch(migration, /create policy/);
  assert.doesNotMatch(migration, /grant\s+/i);
});

test("supabase hardening stays in the critical prebuild contracts", () => {
  assert.equal(
    pkg.scripts["test:supabase-hardening"],
    "node --test __tests__/launch/supabase-hardening-207.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:supabase-hardening/);
});
