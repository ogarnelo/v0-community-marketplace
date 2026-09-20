import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260920120000_listing_photo_storage_hardening.sql",
  "utf8"
);
const newForm = readFileSync("components/marketplace/new-listing-form.tsx", "utf8");
const editPage = readFileSync("app/marketplace/edit/[id]/page.tsx", "utf8");

test("listing photo uploads are scoped to the authenticated user's folder", () => {
  assert.match(migration, /bucket_id = 'listing-photos'/);
  assert.match(migration, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
  assert.match(migration, /file_size_limit = 10485760/);
  assert.match(migration, /image\/jpeg/);
  assert.match(migration, /image\/png/);
  assert.match(migration, /image\/webp/);
  assert.match(migration, /image\/gif/);

  assert.match(newForm, /\$\{userId\}\/\$\{listingId\}\//);
  assert.match(newForm, /uploadListingPhotos\(listingId, user\.id, photos\)/);
  assert.match(editPage, /\$\{userId\}\/\$\{listingIdValue\}\//);
  assert.match(editPage, /uploadNewPhotos\(listingId, user\.id\)/);
});
