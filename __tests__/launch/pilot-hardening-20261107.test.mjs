import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const cron = read("app/api/cron/school-impact-reports/route.ts");
const manual = read("app/api/school/send-impact-report/route.ts");
const subscription = read("app/api/school/report-subscription/route.ts");
const schoolPage = read("app/admin/school/page.tsx");
const report = read("lib/reports/school-impact-report.ts");
const membership = read("lib/reports/school-membership.ts");
const image = read("lib/marketplace/photo-sanitizer.ts");
const newForm = read("components/marketplace/new-listing-form.tsx");
const editForm = read("components/marketplace/edit-listing-form.tsx");
const sql = read("supabase/migrations/20261107170000_pilot_privileges_photo_limit.sql");

test("scheduled reports recheck school role and verified recipient", () => {
  assert.match(cron, /from\("user_roles"\)/);
  assert.match(cron, /eq\("role", "school_admin"\)/);
  assert.match(cron, /getUserById\(subscription.user_id\)/);
  assert.match(cron, /verifiedEmail !== subscription.email/);
  assert.match(cron, /enabled: false/);
});
test("manual sends use account email and atomic database claims", () => {
  assert.match(manual, /email !== user.email.trim\(\).toLowerCase\(\)/);
  assert.match(manual, /claim_school_manual_report_slot/);
  assert.match(manual, /p_school_id: schoolRole.school_id/);
  assert.match(manual, /p_user_id: user.id/);
  assert.match(manual, /status: 429/);
});
test("atomic quota function cannot be called by client roles", () => {
  const sql = read("supabase/migrations/20261107222000_school_manual_report_atomic_quota.sql");
  assert.match(sql, /PRIMARY KEY \(school_id,user_id,utc_day,slot\)/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /ON CONFLICT DO NOTHING/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.claim_school_manual_report_slot/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public.claim_school_manual_report_slot/);
});
test("subscriptions use only the authenticated administrator email", () => {
  assert.match(subscription, /email !== user.email.trim\(\).toLowerCase\(\)/);
});
test("school member rules shared by dashboard and report", () => {
  assert.match(schoolPage, /getSchoolMemberIds/);
  assert.match(report, /getSchoolMemberIds/);
  assert.match(report, /countSchoolStudents/);
  assert.match(report, /Estudiantes vinculados/);
  assert.match(membership, /ownersWithActiveContext/);
});
test("browser roles no longer get destructive TRUNCATE through migration", () => {
  assert.match(sql, /REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated/);
});
test("listing photos are 5 MB maximum with new upload formats", () => {
  assert.match(sql, /file_size_limit = 5242880/);
  assert.match(image, /MAX_LISTING_IMAGE_BYTES = 5 \* 1024 \* 1024/);
  for (const form of [newForm, editForm]) {
    assert.match(form, /await prepareListingImage\(file\)/);
    assert.match(form, /MAX_FILE_SIZE = MAX_LISTING_IMAGE_BYTES/);
    assert.ok(form.startsWith('"use client";'));
  }
});
test("re-encoding strips source metadata and filename", () => {
  assert.match(image, /createImageBitmap/);
  assert.match(image, /canvas.toBlob/);
  assert.match(image, /crypto.randomUUID/);
  assert.doesNotMatch(image, /return file;/);
});

test("educational notifications reject inactive or changed student contexts", () => {
  const dispatcher = read("app/api/marketplace/listings/match-saved-searches/route.ts");
  const eligibility = read("lib/demand/course-alert-eligibility.ts");
  assert.match(dispatcher, /validEducationalSearchIds/);
  assert.match(dispatcher, /isCurrentCourseAlert/);
  assert.match(dispatcher, /eligibleSavedSearches/);
  assert.match(eligibility, /student.active/);
  assert.match(eligibility, /student.school_id === demand.school_id/);
  assert.match(eligibility, /search.school_id === student.school_id/);
  assert.match(eligibility, /student.grade_level === demand.grade_level/);
});
test("student edits and deactivation pause existing educational alerts", () => {
  const students = read("lib/account-students/server.ts");
  const needs = read("lib/my-course/course-need-search-server.ts");
  assert.match(students, /pauseCourseAlertsForStudent/);
  assert.match(needs, /export async function pauseCourseAlertsForStudent/);
  assert.match(needs, /existingDemand.school_id !== need.student.school_id/);
  assert.match(needs, /student_context_changed/);
  assert.match(needs, /in\("demand_request_id", demandIds\)/);
});
