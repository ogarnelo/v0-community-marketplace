import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const page = read("app/beta/mi-curso/page.tsx");
const client = read("components/my-course/my-course-beta-client.tsx");

test("Mi curso Beta 0 is preview-only unless explicitly enabled", () => {
  assert.match(page, /VERCEL_ENV === "preview"/);
  assert.match(page, /WETUDY_MY_COURSE_BETA_ENABLED === "true"/);
  assert.match(page, /notFound\(\)/);
});

test("Beta 0 performs no Supabase writes and stores experiment data locally", () => {
  assert.match(client, /localStorage/);
  assert.match(client, /wetudy_my_course_beta_v0/);
  assert.doesNotMatch(client, /fetch\("\/api\/beta/);
  assert.doesNotMatch(page, /\.insert\(/);
  assert.doesNotMatch(page, /\.update\(/);
  assert.doesNotMatch(page, /\.delete\(/);
});

test("Beta 0 only reads the minimum production data required for matching", () => {
  assert.match(page, /from\("schools"\)/);
  assert.match(page, /from\("listings"\)/);
  assert.match(page, /eq\("status", "available"\)/);
  assert.match(page, /safeListings/);
  assert.doesNotMatch(page, /seller_id/);
  assert.doesNotMatch(page, /user_id/);
  assert.doesNotMatch(page, /postal_code/);
});

test("Mi curso preserves the existing marketplace as the completion path", () => {
  assert.match(client, /\/marketplace\/listing\//);
  assert.match(client, /Buscar por mí/);
  assert.match(client, /Beta 0/);
});
