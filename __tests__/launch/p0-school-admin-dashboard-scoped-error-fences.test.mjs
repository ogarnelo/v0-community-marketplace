import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync("app/admin/school/page.tsx","utf8");
test("all nine initial school-scoped requests have explicit error results",()=>{
 for(const key of ["schoolLookupError","listingsError","memberCountError",
  "accessCodesError","schoolAdminRolesError","donationRequestsError",
  "agreementsError","impactSubscriptionError","impactDeliveriesError"]){
  assert.match(page,new RegExp("error: "+key+" \\}"),key);
 }
 assert.match(page,/if \(listingsError \|\| accessCodesError \|\| schoolAdminRolesError \|\|/);
 assert.match(page,/SCHOOL_DASHBOARD_SCOPED_READ_UNAVAILABLE/);
});
test("reports, listing-views and both names lookups cannot masquerade as empty records",()=>{
 for(const pair of [
  ["reportsError","SCHOOL_DASHBOARD_REPORTS_UNAVAILABLE"],
  ["listingViewsError","SCHOOL_DASHBOARD_VIEWS_UNAVAILABLE"],
  ["schoolAdminsError","SCHOOL_DASHBOARD_ADMIN_NAMES_UNAVAILABLE"],
  ["requesterProfilesError","SCHOOL_DASHBOARD_REQUESTER_NAMES_UNAVAILABLE"]]){
  assert.match(page,new RegExp("if \\("+pair[0]+"\\) throw new Error\\(\""+pair[1]+"\"\\)"));
 }
 assert.match(page,/data: \[\] as ReportRow\[\], error: null/);
 assert.match(page,/data: \[\] as ListingViewRow\[\], error: null/);
});
test("no server-only error or receiver detail is serialized as a successful dashboard",()=>{
 assert.ok(page.indexOf("SCHOOL_DASHBOARD_SCOPED_READ_UNAVAILABLE")<
  page.indexOf("const safeListings ="));
 assert.ok(page.indexOf("SCHOOL_DASHBOARD_REPORTS_UNAVAILABLE")<
  page.indexOf("const safeReports ="));
 assert.doesNotMatch(page,/throw new Error\(.*(?:Error|\.message).*\)/);
});
