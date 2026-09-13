import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const form = readFileSync("components/marketplace/new-listing-form.tsx", "utf8");

test("new listings require at least one photo before publishing", () => {
  assert.match(form, /photos\.length === 0/);
  assert.match(form, /Debes añadir al menos una foto real del material/);
  assert.match(form, /photos: photoUrls/);
  assert.match(form, /from\("listing_photos"\)\.insert\(uploadedPhotoRows\)/);
});
