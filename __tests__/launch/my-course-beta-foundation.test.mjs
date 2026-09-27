import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260927120000_my_course_beta_foundation.sql");
const access = read("lib/my-course/beta-access.ts");
const page = read("app/beta/mi-curso/page.tsx");
const needsRoute = read("app/api/beta/my-course/needs/route.ts");
const learnersRoute = read("app/api/beta/my-course/learners/route.ts");

test("Mi curso is additive and does not replace the stable need identity", () => {
  assert.match(migration, /create table if not exists public\.family_learners/);
  assert.match(migration, /alter table public\.demand_requests/);
  assert.match(migration, /learner_id uuid references public\.family_learners/);
  assert.doesNotMatch(migration, /create table[^;]*public\.needs/i);
  assert.doesNotMatch(migration, /alter table public\.listings/);
  assert.doesNotMatch(migration, /alter table public\.conversations/);
  assert.doesNotMatch(migration, /alter table public\.agreements/);
});

test("the beta has a global kill switch and scoped access", () => {
  assert.match(access, /WETUDY_MY_COURSE_BETA_ENABLED/);
  assert.match(access, /product_feature_access/);
  assert.match(access, /super_admin/);
  assert.match(page, /notFound\(\)/);
});

test("Mi curso reuses existing marketplace demand and saved-search infrastructure", () => {
  assert.match(needsRoute, /from\("demand_requests"\)/);
  assert.match(needsRoute, /from\("saved_searches"\)/);
  assert.match(needsRoute, /from\("listings"\)/);
  assert.match(needsRoute, /source: "my_course_beta"/);
  assert.match(needsRoute, /demand_request_id: need\.id/);
});

test("learner creation is isolated behind beta access and ownership", () => {
  assert.match(learnersRoute, /canUseMyCourseBeta/);
  assert.match(learnersRoute, /parent_user_id: user\.id/);
  assert.match(migration, /Users can read own learners/);
  assert.match(migration, /Users can create own learners/);
});
