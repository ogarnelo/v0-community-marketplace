import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20261108133000_listings_directory_school_context.sql");
const newPage = read("app/marketplace/new/page.tsx");
const newForm = read("components/marketplace/new-listing-form.tsx");
const marketPage = read("app/marketplace/page.tsx");
const marketClient = read("components/marketplace/marketplace-client.tsx");
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
  assert.match(newForm, /comunidad Wetudy todavía no activada/);
});

test("marketplace search separates operational community and national school identity", () => {
  assert.match(marketPage, /directory_school_code/);
  assert.match(marketPage, /viewerDirectorySchoolCode/);
  assert.match(marketPage, /item\.directory_school_code\s*\?\s*null/);
  assert.match(marketClient, /l\.directorySchoolCode !== currentUserDirectorySchoolCode/);
  assert.match(marketClient, /Solo mi colegio/);
});

test("listing detail and editor retain and label national directory reference", () => {
  assert.match(detailPage, /Centro de referencia:/);
  assert.match(detailPage, /directory_school_code/);
  assert.match(editPage, /directory_school_code/);
  assert.match(editPage, /directorio nacional/);
});
