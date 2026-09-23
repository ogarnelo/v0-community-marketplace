import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260923193500_listing_structured_details.sql", "utf8");
const publish = readFileSync("components/marketplace/new-listing-form.tsx", "utf8");
const editPage = readFileSync("app/marketplace/edit/[id]/page.tsx", "utf8");
const editForm = readFileSync("components/marketplace/edit-listing-form.tsx", "utf8");
const detail = readFileSync("app/marketplace/listing/[id]/page.tsx", "utf8");
const marketplace = readFileSync("app/marketplace/page.tsx", "utf8");
const marketplaceClient = readFileSync("components/marketplace/marketplace-client.tsx", "utf8");
const matcher = readFileSync("lib/marketplace/saved-search-matching.ts", "utf8");

test("category-specific details have real listing columns and legacy descriptions are normalized", () => {
  for (const column of ["subject", "specific_type", "size_label", "brand", "model", "season"]) {
    assert.match(migration, new RegExp(`add column if not exists ${column} text`));
  }
  assert.match(migration, /Asignatura:/);
  assert.match(migration, /Detalles del material/);
  assert.match(migration, /split_part\(description/);
});

test("publishing persists structured details without rewriting the user description", () => {
  assert.match(publish, /description: description\.trim\(\)/);
  assert.match(publish, /subject: showTextbookFields/);
  assert.match(publish, /specific_type:/);
  assert.match(publish, /size_label:/);
  assert.match(publish, /brand:/);
  assert.match(publish, /model:/);
  assert.match(publish, /season:/);
  assert.doesNotMatch(publish, /const buildDescription =/);
});

test("listing detail renders structured metadata separately from description", () => {
  assert.match(detail, /author, publisher, format, language, subject, specific_type, size_label, brand, model, season/);
  assert.match(detail, /const structuredDetails = \[/);
  assert.match(detail, /label: "Asignatura"/);
  assert.match(detail, /label: "Editorial"/);
  assert.match(detail, /structuredDetails\.map/);
  assert.match(detail, /\{conditionText\}/);
});

test("editing uses server-validated ownership and the new mobile-first form", () => {
  assert.match(editPage, /const supabase = await createClient\(\)/);
  assert.match(editPage, /typedListing\.seller_id !== user\.id/);
  assert.match(editPage, /EditListingForm/);
  assert.doesNotMatch(editPage, /"use client"/);

  assert.match(editForm, /SectionCard/);
  assert.match(editForm, /Fotos/);
  assert.match(editForm, /Información básica/);
  assert.match(editForm, /Categoría y detalles/);
  assert.match(editForm, /Precio o donación/);
  assert.match(editForm, /initialListing\.author/);
  assert.match(editForm, /initialListing\.publisher/);
  assert.match(editForm, /initialListing\.format/);
  assert.match(editForm, /initialListing\.language/);
  assert.match(editForm, /initialListing\.subject/);
  assert.match(editForm, /author: showBookFields/);
  assert.match(editForm, /publisher: showBookFields/);
  assert.match(editForm, /subject: showTextbookFields/);
});

test("edit condition selector shows only the short label when closed", () => {
  assert.match(editForm, /selectedConditionOption\?\.label \|\| "Seleccionar estado"/);
  assert.match(editForm, /selectedConditionOption\.description/);
  assert.match(editForm, /textValue=\{condition\.label\}/);
});

test("structured fields remain searchable after leaving the description", () => {
  assert.match(marketplace, /subject, specific_type, size_label, brand, model, season/);
  assert.match(marketplaceClient, /l\.subject/);
  assert.match(marketplaceClient, /l\.publisher/);
  assert.match(matcher, /listing\.subject/);
  assert.match(matcher, /listing\.publisher/);
});
