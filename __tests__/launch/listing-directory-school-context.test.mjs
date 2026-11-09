import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20261108133000_listings_directory_school_context.sql");
const newPage = read("app/marketplace/new/page.tsx");
const newForm = read("components/marketplace/new-listing-form.tsx");
const marketPage = read("app/marketplace/page.tsx");
const marketClient = read("components/marketplace/marketplace-client.tsx");
const schoolScope = read("lib/marketplace/school-scope.ts");
const schoolFeedRoute = read("app/api/marketplace/my-school/route.ts");
const detailPage = read("app/marketplace/listing/[id]/page.tsx");
const editPage = read("app/marketplace/edit/[id]/page.tsx");

test("a national reference on listings never activates or masquerades as a community", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS directory_school_code text/);
  assert.match(migration, /REFERENCES public\.school_directory\(official_code\)/);
  assert.match(migration, /school_id IS NULL OR directory_school_code IS NULL/);
  assert.doesNotMatch(migration, /UPDATE public\.school_directory|UPDATE public\.schools|INSERT INTO public\.schools/i);
});

test("publishing prioritizes selected student directory code over a stale profile school", () => {
  assert.match(newPage, /select\("school_id,directory_school_code,is_primary,sort_order,created_at"\)/);
  const studentQuery = newPage.slice(newPage.indexOf('from("account_students")'), newPage.indexOf("const requestedParams"));
  assert.doesNotMatch(studentQuery, /\.not\("school_id", "is", null\)/);
  assert.match(newPage, /primaryStudentContext\s*\?\s*primaryStudentContext\.school_id \|\| null/);
  assert.match(newPage, /primaryStudentContext\?\.directory_school_code/);
  assert.match(newPage, /initialDirectorySchoolCode=\{selectedDirectorySchool\?\.official_code \|\| ""\}/);
});

test("new listing saves the authoritative directory school rather than refetching legacy profile", () => {
  assert.match(newForm, /directory_school_code: directorySchoolCode/);
  assert.match(newForm, /school_id: effectiveSchoolId/);
  assert.match(newForm, /const effectiveSchoolId = initialSchoolId \|\| null/);
  assert.doesNotMatch(newForm, /currentProfile\?\.school_id/);
  assert.match(newForm, /Centro asociado/);
  assert.match(newForm, /<p>\{schoolLabel\}<\/p>/);
  assert.doesNotMatch(newForm, /Centro del directorio nacional · comunidad Wetudy todavía no activada/);
  assert.doesNotMatch(newForm, /La entrega y el pago se acuerdan directamente entre las partes/);
});

test("marketplace search separates operational community and national school identity", () => {
  assert.match(marketPage, /directory_school_code/);
  assert.match(marketPage, /viewerDirectorySchoolCode/);
  assert.match(marketPage, /item\.directory_school_code\s*\?\s*null/);
  assert.match(schoolScope, /linked_school_id/);
  assert.match(schoolScope, /viewerDirectorySchoolCode/);
  assert.match(marketClient, /api\\/marketplace\\/my-school\\?offset=/);
  assert.match(marketClient, /Solo mi colegio/);
});

test("listing detail and editor retain and label national directory reference", () => {
  assert.match(detailPage, /Centro de referencia:/);
  assert.match(detailPage, /directory_school_code/);
  assert.match(editPage, /directory_school_code/);
  assert.match(editPage, /directorio nacional/);
});

test("marketplace always opens on all schools; school count does not derive from the first 60 cards", () => {
  assert.match(marketClient, /const \[onlyMyCommunity, setOnlyMyCommunity\] = useState\(false\)/);
  assert.match(marketPage, /select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(marketPage, /communityListingCount = result\.count/);
  assert.match(marketPage, /makeMarketplaceSchoolFilter/);
  assert.match(marketPage, /initialCommunityListingCount=\{communityListingCount\}/);
  assert.match(marketClient, /highlightSchoolShortcut = \(initialCommunityListingCount \?\? 0\) >= 10/);
  assert.doesNotMatch(marketClient, /setOnlyMyCommunity\(initialCommunityListingCount/);
});

test("empty school feed always explains that other schools remain available", () => {
  assert.match(marketClient, /Aún no hay coincidencias en tu colegio/);
  assert.match(marketClient, /Puedes seguir viendo anuncios de otros centros/);
  assert.match(marketClient, /Ver todos los anuncios/);
  assert.match(marketClient, /setOnlyMyCommunity\(false\)/);
});

test("school feed is loaded in authenticated, paginated chunks rather than filtering the latest 60 global cards", () => {
  assert.match(schoolFeedRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(schoolFeedRoute, /if \(authError \|\| !user\)/);
  assert.match(schoolFeedRoute, /PAGE_SIZE = 60/);
  assert.match(schoolFeedRoute, /\.range\(offset, offset \+ PAGE_SIZE - 1\)/);
  assert.match(schoolFeedRoute, /\.eq\("status", "available"\)\.or\(expression\)/);
  assert.match(schoolFeedRoute, /hasMore: offset \+ listings\.length < total/);
  assert.doesNotMatch(schoolFeedRoute, /searchParams\.get\("schoolId"\)/);
  assert.match(marketClient, /loadMoreSchoolListings/);
  assert.match(marketClient, /Cargar más anuncios de mi colegio/);
  assert.match(schoolScope, /linked_school_id/);
  assert.match(schoolScope, /Never fall back to an old profile/);
});
