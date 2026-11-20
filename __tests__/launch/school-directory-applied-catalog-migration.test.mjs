import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "supabase/migrations/20261108101652_school_directory_catalog.sql", "utf8"
);

test("reconciled directory migration uses the exact already-applied remote version", () => {
  assert.match(source, /CREATE TABLE IF NOT EXISTS public\.school_directory\s*\(/);
  assert.match(source, /official_code text PRIMARY KEY/);
  assert.match(source, /search_text text GENERATED ALWAYS AS/);
  assert.match(source, /linked_school_id uuid UNIQUE REFERENCES public\.schools\(id\)/);
});

test("import and publication remain independently disabled", () => {
  assert.match(source, /is_listed boolean NOT NULL DEFAULT false/);
  assert.match(source, /seo_indexable boolean NOT NULL DEFAULT false/);
  assert.match(source, /review_status text NOT NULL DEFAULT 'pendiente_verificacion_vigencia'/);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO|FROM|TABLE|public\.)/i);
});

test("catalog uses service-only grants and full RLS, without client policies", () => {
  assert.match(source, /ALTER TABLE public\.school_directory ENABLE ROW LEVEL SECURITY;/);
  assert.match(source, /REVOKE ALL ON public\.school_directory FROM PUBLIC, anon, authenticated;/);
  assert.match(source, /GRANT SELECT, INSERT, UPDATE ON public\.school_directory TO service_role;/);
  assert.doesNotMatch(source, /CREATE POLICY|TO anon;|TO authenticated;|GRANT ALL/i);
});

test("catalog indices allow only approved entries to be discoverable", () => {
  for (const name of [
    "school_directory_public_province_name_idx",
    "school_directory_public_zip_idx",
    "school_directory_public_category_idx",
  ]) assert.match(source, new RegExp(name));
  const partialIndexes = source.match(/WHERE is_listed = true;/g) ?? [];
  assert.equal(partialIndexes.length, 3);
});
