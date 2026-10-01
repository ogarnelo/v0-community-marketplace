import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/mi-curso/page.tsx", "utf8");
const client = readFileSync("components/my-course/my-course-client.tsx", "utf8");
const navbar = readFileSync("components/navbar.tsx", "utf8");
const landing = readFileSync("components/landing/hero-section.tsx", "utf8");

test("Mi curso is authenticated and reads real account students", () => {
  assert.match(page, /auth\.getUser\(\)/);
  assert.match(page, /redirect\("\/auth\?next=\/mi-curso"\)/);
  assert.match(page, /from\("account_students"\)/);
  assert.match(page, /\.eq\("owner_user_id", user\.id\)/);
  assert.match(page, /\.eq\("active", true\)/);
  assert.match(page, /relationship === "self"/);
  assert.match(page, /relationship === "guardian"/);
  assert.doesNotMatch(page, /createAdminClient/);
});

test("accounts without educational context are sent to the real onboarding", () => {
  assert.match(page, /studentRows\.length === 0/);
  assert.match(page, /redirect\("\/onboarding\/students\?next=\/mi-curso"\)/);
});

test("Mi curso does not manage student identity or educational context itself", () => {
  assert.match(client, /Gestionar estudiantes/);
  assert.match(client, /href="\/account"/);
  assert.doesNotMatch(client, /\/api\/account\/students/);
  assert.doesNotMatch(client, /schoolId.*onChange.*api/i);
  assert.doesNotMatch(client, /Hijo|hijo|Hija|hija/);
});

test("family selects among real students while student account uses its single context", () => {
  assert.match(client, /accountType === "parent" && students\.length > 1/);
  assert.match(client, /setActiveStudentId/);
  assert.match(page, /userType === "student"[\s\S]*"Mi curso"/);
  assert.match(page, /student\.alias\?\.trim\(\) \|\| "Estudiante "/);
});

test("needs are scoped to a real student and matching prioritizes school and grade", () => {
  assert.match(client, /studentId: activeStudent\.id/);
  assert.match(client, /need\.studentId === activeStudent\?\.id/);
  assert.match(client, /listing\.schoolId === student\.schoolId/);
  assert.match(client, /listing\.gradeLevel === student\.gradeLevel/);
  assert.match(client, /listing\.category === need\.category/);
  assert.match(client, /isbnMatch/);
  assert.match(client, /tokenRatio/);
});

test("Mi curso persists needs separately from saved-search and demand tables", () => {
  assert.match(page, /listCourseNeeds/);
  assert.match(client, /\/api\/my-course\/needs/);
  assert.doesNotMatch(client, /window\.localStorage\.setItem/);
  assert.doesNotMatch(client, /se guardan en este navegador/);
  assert.doesNotMatch(client, /saved_searches/);
  assert.doesNotMatch(client, /demand_requests/);
  assert.doesNotMatch(page, /saved_searches/);
  assert.doesNotMatch(page, /demand_requests/);
});

test("authenticated navigation exposes Mi curso immediately after Marketplace", () => {
  const marketplaceIndex = navbar.indexOf('{ href: "/marketplace", label: "Marketplace"');
  const myCourseIndex = navbar.indexOf('{ href: "/mi-curso", label: "Mi curso"');
  const favoritesIndex = navbar.indexOf('{ href: "/favorites", label: "Favoritos"');

  assert.ok(marketplaceIndex > -1);
  assert.ok(myCourseIndex > marketplaceIndex);
  assert.ok(favoritesIndex > myCourseIndex);
  assert.match(navbar, /if \(href === "\/mi-curso"\) return pathname === "\/mi-curso"/);
  assert.doesNotMatch(landing, /Mi curso/);
});

test("Mi curso links current matches to the existing listing flow", () => {
  assert.match(client, /\/marketplace\/listing\/\$\{listing\.id\}/);
  assert.match(client, /Sin coincidencias ahora/);
  assert.match(client, /Explorar Marketplace/);
});
