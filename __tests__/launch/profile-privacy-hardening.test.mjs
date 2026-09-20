import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260920111500_profile_privacy_hardening.sql");
const publicProfile = read("app/profile/[id]/page.tsx");
const messagesPage = read("app/messages/page.tsx");
const messageDetail = read("app/messages/[id]/page.tsx");
const accountListings = read("app/account/listings/page.tsx");
const sidebar = read("components/messages/conversations-sidebar.tsx");
const conversationSummary = read("app/api/messages/conversation-summary/route.ts");
const joinSchool = read("app/onboarding/join-school/page.tsx");
const accountProfile = read("components/account/account-profile-form.tsx");
const resolveCode = read("app/api/schools/resolve-code/route.ts");
const shipmentLabel = read("app/api/shipments/create-label/route.ts");

test("profiles no longer expose every row to every authenticated user", () => {
  assert.match(migration, /drop policy if exists profiles_select_authenticated/);
  assert.match(migration, /profiles_select_own_or_superadmin/);
  assert.match(migration, /\(\(select auth\.uid\(\)\) = id\)/);
  assert.match(migration, /select public\.is_superadmin\(\)/);
  assert.doesNotMatch(migration, /profiles[\s\S]*for select[\s\S]*using \(true\)/i);
});

test("public and chat profile reads are server-side and field-limited", () => {
  assert.match(publicProfile, /createAdminClient/);
  assert.match(publicProfile, /id, full_name, user_type, business_name, business_description, website, is_business_verified/);
  assert.doesNotMatch(publicProfile, /sellerPostalCode|sellerGradeLevel/);
  assert.doesNotMatch(publicProfile, /"id, full_name, user_type, grade_level, postal_code/);

  assert.match(messagesPage, /const admin = createAdminClient\(\)/);
  assert.match(messageDetail, /adminSupabase\.from\("profiles"\)/);
  assert.match(accountListings, /const admin = createAdminClient\(\)/);
  assert.match(accountListings, /admin[\s\S]*\.from\("profiles"\)[\s\S]*\.select\("id, full_name"\)/);
  assert.doesNotMatch(sidebar, /\.from\("profiles"\)/);
  assert.match(sidebar, /\/api\/messages\/conversation-summary/);

  assert.match(conversationSummary, /supabase\.auth\.getUser\(\)/);
  assert.match(conversationSummary, /\.from\("conversations"\)/);
  assert.match(conversationSummary, /admin[\s\S]*\.from\("profiles"\)[\s\S]*\.select\("full_name"\)/);
});

test("school access codes cannot be enumerated by ordinary authenticated users", () => {
  assert.match(migration, /drop policy if exists school_access_codes_select_authorized/);
  assert.match(migration, /ur\.role = 'school_admin'/);
  assert.match(migration, /ur\.school_id = school_access_codes\.school_id/);
  assert.match(migration, /select public\.is_superadmin\(\)/);

  assert.doesNotMatch(joinSchool, /\.from\("school_access_codes"\)/);
  assert.doesNotMatch(accountProfile, /\.from\("school_access_codes"\)/);
  assert.match(joinSchool, /\/api\/schools\/resolve-code/);
  assert.match(accountProfile, /\/api\/schools\/resolve-code/);

  assert.match(resolveCode, /supabase\.auth\.getUser\(\)/);
  assert.match(resolveCode, /createAdminClient/);
  assert.match(resolveCode, /\.eq\("code", code\)/);
  assert.match(resolveCode, /\.eq\("is_active", true\)/);
  assert.doesNotMatch(resolveCode, /select\(".*code.*"\)/);
});

test("future shipping contact data stays stored but server-controlled", () => {
  assert.match(accountProfile, /shipping_address_line1/);
  assert.match(accountProfile, /phone:/);
  assert.match(shipmentLabel, /createAdminClient/);
  assert.match(shipmentLabel, /shipping_address_line1/);
  assert.match(shipmentLabel, /phone/);
});
