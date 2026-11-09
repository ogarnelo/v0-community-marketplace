import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

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
  assert.match(schoolFeedRoute, /applyMarketplaceFeedFilters\(/);
  assert.match(schoolFeedRoute, /filters, expression/);
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
  assert.match(feed, /applyMarketplaceFeedFilters\(/);
  assert.match(read("lib/marketplace/feed-filters.ts"), /\.order\("id", \{ ascending: false \}\)/);
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

function loadServerFeedFilters() {
  const source = read("lib/marketplace/feed-filters.ts");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, URLSearchParams });
  return exports;
}

test("server search parses bounded inputs and preserves school scope with text and donated items", () => {
  const { parseMarketplaceFeedFilters, buildMarketplacePostgrestExpression,
          applyMarketplaceFeedFilters } = loadServerFeedFilters();
  const filters = parseMarketplaceFeedFilters(new URLSearchParams({
    q: "libro),status.eq.sold", category: "books",
    minPrice: "15", maxPrice: "40", sort: "price_asc",
    isbn: "978-84-100-9999-1",
  }));
  assert.equal(filters.text, "libro status eq sold");
  assert.equal(filters.isbn, "9788410099991");
  const scope = "school_id.eq.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,directory_school_code.in.(12345678)";
  const expression = buildMarketplacePostgrestExpression(filters, scope);
  assert.match(expression, /^and\(or\(school_id\.eq/);
  assert.match(expression, /or\(title\.ilike\.\*libro status eq sold\*/);
  assert.match(expression, /or\(type\.eq\.donation,and\(price\.gte\.15,price\.lte\.40\)\)/);
  assert.doesNotMatch(expression, /status\.eq\.sold/);
  const calls = [];
  const query = {
    eq(...args) { calls.push(["eq", ...args]); return this; },
    ilike(...args) { calls.push(["ilike", ...args]); return this; },
    or(...args) { calls.push(["or", ...args]); return this; },
    gte(...args) { calls.push(["gte", ...args]); return this; },
    order(...args) { calls.push(["order", ...args]); return this; },
  };
  applyMarketplaceFeedFilters(query, filters, scope);
  assert.equal(calls.filter(([op]) => op === "or").length, 1);
  assert.ok(calls.some(([op, col, value]) =>
    op === "ilike" && col === "isbn" && value === "%9788410099991%"));
  assert.ok(calls.some(([op, col]) => op === "order" && col === "price"));
});

test("server-side filters fail closed for invalid price, type and date parameters", () => {
  const { parseMarketplaceFeedFilters, buildMarketplacePostgrestExpression } =
    loadServerFeedFilters();
  for (const bad of [
    { minPrice: "201" }, { minPrice: "90", maxPrice: "10" },
    { listingType: "user_roles" }, { maxPrice: "-1" },
    { since: "1900-01-01T00:00:00.000Z" },
  ]) {
    assert.throws(() => parseMarketplaceFeedFilters(new URLSearchParams(bad)));
  }
  const safe = parseMarketplaceFeedFilters(new URLSearchParams({
    q: "Polo (talla 12),.or(is_demo.eq.false)%_",
  }));
  const expression = buildMarketplacePostgrestExpression(safe);
  assert.doesNotMatch(expression, /\),\.or\(|is_demo\.eq/);
  const blank = parseMarketplaceFeedFilters(new URLSearchParams());
  assert.equal(buildMarketplacePostgrestExpression(blank), null);
});

test("both listing routes apply shared server-side filters before pagination", () => {
  for (const path of [
    "app/api/marketplace/feed/route.ts",
    "app/api/marketplace/my-school/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /parseMarketplaceFeedFilters\(params\)/);
    assert.match(source, /applyMarketplaceFeedFilters\(/);
    assert.ok(source.indexOf("applyMarketplaceFeedFilters(") <
      source.indexOf(".range(offset, offset + PAGE_SIZE"));
    assert.match(source, /status: 400/);
    assert.match(source, /Cache-Control": "private, no-store"/);
  }
  const school = read("app/api/marketplace/my-school/route.ts");
  assert.match(school, /filters, expression/);
  assert.match(school, /supabase\.auth\.getUser/);
});

test("marketplace client searches all server-side listings before displaying an empty state", () => {
  const client = read("components/marketplace/marketplace-client.tsx");
  assert.match(client, /params\.set\("q", searchQuery\.trim\(\)/);
  for (const name of ["isbn", "category", "gradeLevel", "listingType",
                      "condition", "minPrice", "maxPrice", "sort", "since"]) {
    assert.ok(client.includes('params.set("' + name + '"'),
      "Missing server-side filter parameter " + name);
  }
  assert.match(client, /setDebouncedFeedFilters\(feedFilters\)/);
  assert.match(client, /"\/api\/marketplace\/feed\?offset=0&" \+ requestKey/);
  assert.match(client, /"\/api\/marketplace\/my-school\?offset=0"/);
  assert.match(client, /generalFeedPending \|\| schoolFeedPending/);
  assert.match(client, /generalAppliedKey !== debouncedFeedFilters/);
  assert.match(client, /schoolAppliedKey !== debouncedFeedFilters/);
  assert.match(client, /generalActiveKeyRef\.current !== requestKey/);
  assert.match(client, /schoolActiveKeyRef\.current !== requestKey/);
  assert.match(client, /if \(!requestKey\) setSchoolCount\(payload\.total \?\? null\)/);
  assert.doesNotMatch(client, /normalizeText\(searchQuery\)/);
  assert.match(client, /No se pudo completar la búsqueda/);
});

test("filtered auto-pagination keeps query parameters through both feeds", () => {
  const client = read("components/marketplace/marketplace-client.tsx");
  assert.match(client, /\/api\/marketplace\/feed\?offset=\$\{generalOffset\}/);
  assert.match(client, /\/api\/marketplace\/my-school\?offset=\$\{schoolOffset\}/);
  assert.match(client, /requestKey \? "&" \+ requestKey : ""/);
  assert.match(client, /generalAppliedKey !== debouncedFeedFilters \|\| filterDebouncing/);
  assert.match(client, /schoolAppliedKey !== debouncedFeedFilters \|\| filterDebouncing/);
  assert.match(client, /observer\.disconnect\(\)/);
  assert.match(client, /Cargando más anuncios/);
  assert.match(client, /sortBy === "distance" \|\| sortBy === "discount"/);
});

test("search signals do not fire from anonymous browsing or every infinite-scroll page", () => {
  const client = read("components/marketplace/marketplace-client.tsx");
  const page = read("app/marketplace/page.tsx");
  assert.match(page, /initialIsAuthenticated=\{Boolean\(user\)\}/);
  assert.match(client, /!initialIsAuthenticated \|\| filterDebouncing/);
  assert.match(client, /observedDemandKeyRef\.current === key/);
  assert.match(client, /observedDemandKeyRef\.current = key/);
  assert.match(client, /observedDemandKeyRef\.current = ""/);
  assert.match(client, /rawSearchQuery\.length === 1 \|\| rawIsbnQuery\.length === 1/);
  assert.match(client, /controller\.abort\(\)/);
  assert.match(client, /schoolAppliedKey === debouncedFeedFilters/);
  assert.match(client, /generalAppliedKey === debouncedFeedFilters/);
  assert.match(client, /fetch\("\/api\/marketplace\/search-events"/);
  assert.match(client, /resultsCount: filteredListings\.length/);
  const start = client.indexOf('    // Record search intent once per settled query');
  const stop = client.indexOf('  useEffect(() => {\n    setSaveSearchStatus("idle");', start);
  assert.ok(start >= 0 && stop > start);
  const observation = client.slice(start, stop);
  const deps = observation.slice(observation.lastIndexOf('  }, ['));
  assert.doesNotMatch(deps, /filteredListings\.length|schoolListings\.length|dbListings\.length/);
  assert.doesNotMatch(deps, /generalOffset|schoolOffset/);
});

test("approximate radius scans all remaining pages, never stops at an arbitrary count", () => {
  const client = read("components/marketplace/marketplace-client.tsx");
  assert.match(client, /const radiusMayHaveUnseenMatches = radiusIsApproximate &&/);
  assert.match(client, /generalHasMore && filteredListings\\.length === 0/);
  assert.match(client, /radiusMayHaveUnseenMatches \\? <div role="status"/);
  assert.match(client, /puede haber otros anuncios en páginas posteriores/);
  assert.match(client, /Continuamos examinando las siguientes publicaciones hasta terminar el catálogo/);
  assert.match(client, /const waiting = filterDebouncing \\|\\| \\(onlyMyCommunity/);
  assert.match(client, /observer\\.observe\\(target\\)/);
  assert.match(client, /rootMargin: "360px 0px"/);
  assert.doesNotMatch(client, /radiusPrefetchCap|generalOffset >= 180|radiusPrefetchCapReached/);
  assert.doesNotMatch(client, /Ver anuncios sin límite de distancia/);
  assert.match(client, /generalHasMore/);
  assert.match(client, /Distancia aproximada/);
});

test("missing postal code explains disabled distance filter without new UI", () => {
  const client = read("components/marketplace/marketplace-client.tsx");
  assert.match(client, /disabled=\\{onlyMyCommunity \\|\\| !hasViewerPostalCode\\}/);
  assert.match(client, /onPointerDownCapture=\\{explainMissingPostalCode\\}/);
  assert.match(client, /onKeyDownCapture=\\{\\(event\\) =>/);
  assert.match(client, /role=\\{!hasViewerPostalCode && !onlyMyCommunity \\? "button"/);
  assert.match(client, /tabIndex=\\{!hasViewerPostalCode && !onlyMyCommunity \\? 0/);
  assert.match(client, /marketplace-postal-code-required/);
  assert.match(client, /duration: 5000/);
  assert.match(client, /window\\.location\\.assign\\("\\/account"\\)/);
  assert.match(client, /if \\(onlyMyCommunity \\|\\| hasViewerPostalCode\\) return/);
  assert.doesNotMatch(client, /<Dialog|<AlertDialog/);
});

test("a failed next-page request can be manually retried without resuming endless auto retries", () => {
  const client = read("components/marketplace/marketplace-client.tsx");
  assert.match(client, /generalLoading \\|\\| generalLoadError \\|\\| !generalHasMore/);
  assert.match(client, /schoolLoading \\|\\| schoolLoadError \\|\\| !schoolHasMore/);
  assert.match(client, /onClick=\\{loadMoreGeneralListings\\}>Reintentar carga/);
  assert.match(client, /onClick=\\{loadMoreSchoolListings\\}>Reintentar carga/);
  assert.doesNotMatch(client, /generalLoadError \\|\\| generalRequestInFlight\\.current\\) return/);
  assert.doesNotMatch(client, /schoolLoadError \\|\\| schoolRequestInFlight\\.current\\) return/);
});

