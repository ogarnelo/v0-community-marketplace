import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getDirectorySearch, SCHOOL_DIRECTORY_PAGE_SIZE } from "../../lib/schools/directory-search.ts";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const parse = (value) => getDirectorySearch(new URLSearchParams(value));

test("default is a small first page, not a preload of all 34,845 centres", () => {
  const result = parse("");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.page, 1);
  assert.equal(result.pattern, null);
  assert.equal(SCHOOL_DIRECTORY_PAGE_SIZE, 24);
});
test("literal code, name and municipality input are accepted", () => {
  for (const value of ["q=36006122", "q=CEIP+A+Xunqueira", "q=Pontevedra"]) {
    const result = parse(value);
    assert.equal(result.ok, true);
  }
});
test("malicious wildcard search is escaped and does not broaden queries", () => {
  const result = parse("q=%25_%5C");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pattern, "%\\%\\_\\\\%");
});
test("unrecognized community, malformed province and excess page limits fail", () => {
  for (const value of ["community=Atlantis", "province=Madrid%40bad", "page=-5", "page=0", "page=2001",
    "page=1e8", "q=" + "x".repeat(81), "q=abc%0Adef"]) {
    assert.equal(parse(value).ok, false, value);
  }
});
test("Spanish community, province filters and deep pages are accepted", () => {
  const result = parse("community=Galicia&province=Pontevedra&page=1452&q=colegio");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.page, 1452);
  assert.equal(result.community, "Galicia");
  assert.equal(result.province, "Pontevedra");
  assert.equal(parse("community=Comunidad+de+Madrid&province=Madrid").ok, true);
});
test("DB migration keeps catalog records unpublished and disconnected from AMPA roles", () => {
  const sql = read("supabase/migrations/20261107235900_school_directory_catalog.sql");
  assert.match(sql, /official_code text PRIMARY KEY/);
  assert.match(sql, /autonomous_community text NOT NULL/);
  assert.match(sql, /postal_code/);
  assert.match(sql, /is_listed boolean NOT NULL DEFAULT false/);
  assert.match(sql, /linked_school_id uuid UNIQUE REFERENCES public.schools/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public.school_directory FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(sql, /INSERT INTO public.schools|INSERT INTO public.user_roles|INSERT INTO public.school_access_codes/);
});
test("directory API returns only explicitly approved listing fields", () => {
  const api = read("app/api/school-directory/route.ts");
  assert.match(api, /\.eq\("is_listed", true\)/);
  assert.match(api, /\.range\(first, first \+ SCHOOL_DIRECTORY_PAGE_SIZE - 1\)/);
  assert.match(api, /getDirectorySearch/);
  assert.match(api, /parsed.community/);
  assert.doesNotMatch(api, /school_admin|school_access_codes|federation_admins|telephone|phone|linked_school_id/);
  assert.match(api, /"Cache-Control"/);
});
test("directory page does not claim membership or use an unbounded drop-down", () => {
  const page = read("app/centros/page.tsx");
  assert.match(page, /no significa/);
  assert.match(page, /adhesión a Wetudy no confirmada/);
  assert.match(page, /Ministerio de Educación/);
  assert.match(page, /seis códigos de Galicia/i);
  assert.match(page, /independiente/);
  assert.match(page, /api\/school-directory/);
  assert.match(page, /DIRECTORY_COMMUNITIES/);
  assert.match(page, /setPage\(1\)/);
  assert.doesNotMatch(page, /from\("schools"\)/);
});
