import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const server = readFileSync("lib/my-course/course-need-history-server.ts", "utf8");
const page = readFileSync("app/mi-curso/page.tsx", "utf8");
const client = readFileSync("components/my-course/my-course-client.tsx", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("fulfilled Mi curso history is loaded with explicit ownership and course-need attribution", () => {
  assert.match(server, /listFulfilledCourseNeeds/);
  assert.match(server, /\.eq\("owner_user_id", userId\)/);
  assert.match(server, /\.eq\("status", "fulfilled"\)/);
  assert.match(server, /from\("demand_requests"\)/);
  assert.match(server, /\.eq\("user_id", userId\)/);
  assert.match(server, /\.eq\("source", "course_need"\)/);
  assert.match(server, /confirmed_agreement_id/);
  assert.match(server, /matched_listing_id/);
  assert.match(server, /conversation_id/);
});

test("history preserves useful agreement and listing context without requiring the listing to remain available", () => {
  assert.match(server, /from\("agreements"\)/);
  assert.match(server, /\.eq\("status", "confirmed"\)/);
  assert.match(server, /agreement_type/);
  assert.match(server, /agreement_amount/);
  assert.match(server, /from\("listings"\)/);
  assert.match(server, /listing_status/);
  assert.doesNotMatch(server, /\.eq\("status", "available"\).*from\("listings"\)/s);
});

test("Mi curso renders a Conseguidos history per student", () => {
  assert.match(page, /listFulfilledCourseNeeds/);
  assert.match(page, /fulfilledNeeds=\{fulfilledNeeds\}/);
  assert.match(client, /type FulfilledNeed/);
  assert.match(client, /fulfilledForStudent/);
  assert.match(client, /Conseguidos/);
  assert.match(client, /Conseguido/);
  assert.match(client, /Ver anuncio/);
  assert.match(client, /Ver conversación/);
});

test("course-need history is part of the critical prebuild contracts", () => {
  assert.equal(
    pkg.scripts["test:course-need-history"],
    "node --test __tests__/launch/course-need-history.test.mjs"
  );
  assert.match(pkg.scripts["test:critical-contracts"], /test:course-need-history/);
});
