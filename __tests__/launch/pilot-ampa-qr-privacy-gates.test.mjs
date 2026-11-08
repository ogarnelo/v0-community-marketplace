import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(p, "utf8");
const admin = read("app/admin/school/page.tsx");
const qr = read("app/api/school/share-qr/route.ts");
const join = read("app/onboarding/join-school/page.tsx");
const schools = read("app/api/schools/public/route.ts");
const terms = read("app/terms/page.tsx");
const privacy = read("app/privacy/page.tsx");
const auth = read("components/auth/auth-form.tsx");

test("AMPA reports are queried only for the authorized school's listing IDs", () => {
  assert.match(admin, /\.from\("listings"\)[\s\S]*?\.eq\("school_id", effectiveSchoolId\)/);
  assert.match(admin, /const listingIds = safeListings\.map\(\(item\) => item\.id\)/);
  assert.match(admin, /const \{ data: reports \} = listingIds\.length > 0/);
  assert.match(admin, /\.from\("reports"\)[\s\S]*?\.eq\("target_type", "listing"\)\s*\.in\("listing_id", listingIds\)/);
  assert.match(admin, /: \{ data: \[\] as ReportRow\[\] \}/);
  assert.match(admin, /const safeListingReports = safeReports\.filter/);
  assert.doesNotMatch(admin, /\.from\("reports"\)[\s\S]*?\.eq\("target_type", "listing"\)\s*\.order\("created_at"/);
});

test("QR is role-gated; no public endpoint reveals school access codes", () => {
  assert.match(qr, /if \(!user\)/);
  assert.match(qr, /role === "school_admin"/);
  assert.match(qr, /getAuthPublicOrigin\(\)/);
  assert.match(qr, /baseShareUrl\.searchParams\.set\("school", schoolRole\.school_id\)/);
  assert.match(schools, /\.eq\("is_active", true\)/);
  assert.match(schools, /\.eq\("is_test", false\)/);
  assert.match(schools, /\.select\("id, name, city"\)/);
  assert.doesNotMatch(schools, /school_access_codes/);
  assert.match(join, /Debes iniciar sesión para vincular el centro/);
});

test("pre-pilot minors and legal disclosures remain explicit pending legal completion", () => {
  assert.match(auth, /userType === "student" && !studentAgeConfirmed/);
  assert.match(auth, /Confirmo que tengo 14 años o más/);
  assert.match(terms, /identificación legal completa del prestador se incorporará/);
  assert.match(privacy, /identificación legal completa del responsable del tratamiento se/);
});
