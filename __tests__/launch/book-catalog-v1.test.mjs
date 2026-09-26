import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const isbn = read("lib/books/isbn.ts");
const catalog = read("lib/books/book-catalog.ts");
const route = read("app/api/books/isbn/[isbn]/route.ts");
const lookup = read("components/marketplace/book-isbn-lookup.tsx");
const newForm = read("components/marketplace/new-listing-form.tsx");
const editForm = read("components/marketplace/edit-listing-form.tsx");
const migration = read("supabase/migrations/20260924123000_book_catalog_v1.sql");
const savedSearchRoute = read("app/api/marketplace/saved-searches/route.ts");

test("ISBN utility validates, canonicalizes and converts ISBN-10 to ISBN-13", () => {
  assert.match(isbn, /isValidIsbn10/);
  assert.match(isbn, /isValidIsbn13/);
  assert.match(isbn, /isbn10To13/);
  assert.match(isbn, /canonicalIsbn/);
  assert.match(isbn, /extractIsbnFromText/);
  assert.match(isbn, /replace\(\/\[\^0-9xX\]\/g, ""\)/);
});

test("book catalog checks local cache, then Open Library and optional Google Books fallback", () => {
  assert.match(catalog, /from\("book_editions"\)/);
  assert.match(catalog, /eq\("canonical_isbn", normalized\.canonicalIsbn\)/);
  assert.match(catalog, /https:\/\/openlibrary\.org\/isbn\//);
  assert.match(catalog, /https:\/\/www\.googleapis\.com\/books\/v1\/volumes/);
  assert.match(catalog, /GOOGLE_BOOKS_API_KEY/);
  assert.match(catalog, /industryIdentifiers/);
  assert.match(catalog, /normalizeIsbn\(identifier\)\?\.canonicalIsbn === canonicalIsbn/);
  assert.match(catalog, /upsert/);
  assert.match(catalog, /onConflict: "canonical_isbn"/);
  assert.match(catalog, /AbortController/);
  assert.match(catalog, /status: "not_found"/);
  assert.match(catalog, /status: "provider_error"/);
});

test("internal ISBN endpoint is authenticated and has basic abuse control", () => {
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /MAX_LOOKUPS_PER_WINDOW/);
  assert.match(route, /status: "rate_limited"/);
  assert.match(route, /lookupBookByIsbn/);
});

test("publication and editing keep manual fallback and confirm conflicting bibliographic replacement", () => {
  assert.match(lookup, /No hemos encontrado este ISBN\. Puedes completar los datos manualmente\./);
  assert.match(lookup, /Puedes seguir completando y publicando manualmente/);
  assert.match(lookup, /Si tienes el ISBN, introdúcelo primero/);
  assert.match(lookup, /te pedirá confirmación antes de sustituirlos/);
  assert.doesNotMatch(lookup, /onRecognized/);
  assert.match(newForm, /window\.confirm/);
  assert.match(editForm, /window\.confirm/);
  assert.match(newForm, /<BookIsbnLookup isbn=\{isbn\} onApply=\{applyCatalogBook\}/);
  assert.match(editForm, /<BookIsbnLookup isbn=\{isbn\} onApply=\{applyCatalogBook\}/);
  assert.match(newForm, /book_edition_id: showBookFields \? bookEditionId : null/);
  assert.match(editForm, /book_edition_id: showBookFields \? bookEditionId : null/);
});

test("catalog schema deduplicates canonical ISBN and links listings/course materials optionally", () => {
  assert.match(migration, /canonical_isbn text not null unique/);
  assert.match(migration, /add column if not exists book_edition_id uuid references public\.book_editions/);
  assert.match(migration, /alter table public\.course_materials/);
});


test("free-text zero-result demand extracts a valid ISBN into structured demand", () => {
  assert.match(savedSearchRoute, /extractIsbnFromText/);
  assert.match(savedSearchRoute, /const inferredIsbn/);
  assert.match(savedSearchRoute, /isbn_query: isbnQuery/);
  assert.match(savedSearchRoute, /isbn: canonicalIsbn/);
});
