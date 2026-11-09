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
  assert.ok(marketClient.includes("/api/marketplace/my-school?offset="));
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
  assert.match(marketClient, /highlightSchoolShortcut = \(schoolCount \?\? 0\) >= 10/);
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
  assert.match(marketClient, /feedSentinelRef/);
  assert.match(marketClient, /loadMoreSchoolListings/);
  assert.match(schoolScope, /linked_school_id/);
  assert.match(schoolScope, /Never fall back to an old profile/);
});

test("school inventory nudge keeps the current layout and opens the filter only by user action", () => {
  // Opening /marketplace always means opening the full catalogue.
  assert.match(marketClient, /const \[onlyMyCommunity, setOnlyMyCommunity\] = useState\(false\)/);
  assert.match(marketClient, /subtleSchoolShortcut = \(schoolCount \?\? 0\) >= 5/);
  assert.match(marketClient, /highlightSchoolShortcut = \(schoolCount \?\? 0\) >= 10/);
  assert.match(marketClient, /border-primary\/20 bg-card/);
  assert.match(marketClient, /border-primary\/40 bg-primary\/5/);
  assert.match(marketClient, /schoolCount < 10/);
  assert.match(marketClient, /toast\("¡Tu colegio ya tiene movimiento!"/);
  assert.match(marketClient, /label: "Ver mi colegio"/);
  assert.match(marketClient, /onClick: \(\) => setOnlyMyCommunity\(true\)/);
  assert.doesNotMatch(marketClient, /useEffect\(\(\) => setOnlyMyCommunity\(true\)/);
  // Reuse the global Sonner toaster, without a new modal or page layout.
  assert.match(marketClient, /import \{ toast \} from "sonner"/);
  assert.match(marketClient, /duration: 7500/);
});

test("school inventory invitation is limited to one per session and school", () => {
  assert.match(marketClient, /wetudy:school-invite:/);
  assert.match(marketClient, /sessionStorage\.getItem\(storageKey\)/);
  assert.match(marketClient, /sessionStorage\.setItem\(storageKey, "seen"\)/);
  assert.match(marketClient, /onlyMyCommunity \|\| showSchoolInvite/);
  assert.match(marketClient, /return \(\) => window\.clearTimeout\(handle\)/);
  assert.match(marketClient, /return;\s*\}\s*toast\(/);
});


test("general catalogue continues after sixty cards without forcing school filter", () => {
  const page = read("app/marketplace/page.tsx");
  const client = read("components/marketplace/marketplace-client.tsx");
  const feed = read("app/api/marketplace/feed/route.ts");
  assert.match(page, /\.limit\(61\)/);
  assert.match(page, /initialGeneralHasMore/);
  assert.match(page, /\.slice\(0, 60\)/);
  assert.match(client, /const \[onlyMyCommunity, setOnlyMyCommunity\] = useState\(false\)/);
  assert.match(client, /loadMoreGeneralListings/);
  assert.match(client, /IntersectionObserver/);
  assert.match(client, /Cargando más anuncios/);
  assert.match(feed, /PAGE_SIZE = 60/);
  assert.match(feed, /\.range\(offset, offset \+ PAGE_SIZE\)/);
  assert.match(feed, /\.eq\("status", "available"\)/);
  assert.match(feed, /\.order\("id", \{ ascending: false \}\)/);
  assert.match(feed, /Cache-Control": "private, no-store"/);
  assert.match(feed, /const hasMore = allRows\.length > PAGE_SIZE/);
  assert.doesNotMatch(feed, /service_role|schoolId=|directorySchoolCode=/);
});

test("both marketplace feeds auto-load on scroll without load-more buttons", () => {
  assert.match(marketClient, /new IntersectionObserver/);
  assert.match(marketClient, /rootMargin: "360px 0px"/);
  assert.match(marketClient, /observer\.observe\(target\)/);
  assert.match(marketClient, /observer\.disconnect\(\)/);
  assert.match(marketClient, /entry\?\.isIntersecting/);
  assert.match(marketClient, /onlyMyCommunity\) void loadMoreSchoolListings\(\)/);
  assert.match(marketClient, /else void loadMoreGeneralListings\(\)/);
  assert.match(marketClient, /ref=\{feedSentinelRef\}/);
  assert.doesNotMatch(marketClient, /Cargar más anuncios de mi colegio/);
  assert.doesNotMatch(marketClient, />Cargar más anuncios<\/Button>/);
  assert.match(marketClient, /Cargando más anuncios/);
});

test("pagination is sequential, de-duplicates cards and pauses on network failures", () => {
  assert.match(marketClient, /generalRequestInFlight\.current/);
  assert.match(marketClient, /schoolRequestInFlight\.current/);
  assert.match(marketClient, /setGeneralOffset\(\(current\) => current \+ rows\.length\)/);
  assert.match(marketClient, /setSchoolOffset\(\(current\) => current \+ rows\.length\)/);
  assert.match(marketClient, /!ids\.has\(listing\.id\)/);
  assert.match(marketClient, /!ids\.has\(item\.id\)/);
  assert.match(marketClient, /generalLoading \|\| generalLoadError \|\| !generalHasMore/);
  assert.match(marketClient, /schoolLoading \|\| schoolLoadError \|\| !schoolHasMore/);
  assert.match(marketClient, /schoolLoadError && !schoolLoaded/);
  assert.match(marketClient, /Reintentar carga/);
  assert.match(marketClient, /role="status"/);
});
