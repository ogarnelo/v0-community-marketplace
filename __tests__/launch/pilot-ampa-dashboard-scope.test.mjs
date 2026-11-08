import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/admin/school/page.tsx", "utf8");

test("AMPA dashboard resolves active school from session role, not user input", () => {
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /\.from\("user_roles"\)[\s\S]*?\.eq\("user_id", user\.id\)/);
  assert.match(page, /const effectiveSchoolId = schoolAdminRole\?\.school_id \|\| null/);
  assert.match(page, /if \(!effectiveSchoolId\)[\s\S]*?redirect\("\/"\)/);
});

test("AMPA dashboard uses school-scoped queries for listing and sensitive data", () => {
  for (const table of ["listings", "school_access_codes", "donation_requests", "agreements"]) {
    const start=page.indexOf('.from("'+table+'")');
    assert.ok(start >= 0, 'missing '+table);
    assert.match(page.slice(start, start+570), /\.eq\("school_id", effectiveSchoolId\)/,table+' not scoped');
  }
  const reportAt=page.indexOf('.from("reports")');
  assert.ok(reportAt>=0);
  assert.match(page.slice(reportAt,reportAt+550), /\.in\("listing_id", listingIds\)/);
});

test("AMPA panel does not expose full family profiles to dashboard client", () => {
  assert.match(page, /const memberCount = Number\(memberCountData\)/);
  assert.match(page, /\.rpc\("server_school_member_count", \{ p_school_id: effectiveSchoolId \}\)/);
  assert.match(page, /School admins can see the size of their self-selected community/);
});

// The server must only request a school-scoped scalar from the database,
 // never pull all family/student IDs into the Node process.
test("AMPA membership aggregation is service-role restricted and school-scoped", () => {
  assert.match(page, /adminSupabase\.rpc\("server_school_member_count", \{ p_school_id: effectiveSchoolId \}\)/);
  assert.doesNotMatch(page, /profilesForCommunity|activeStudentContexts|safeMembers/);
  assert.doesNotMatch(page, /\.limit\(10000\)|\.limit\(20000\)/);
  assert.match(page, /if \(memberCountError \|\| memberCountData == null\)/);
});
