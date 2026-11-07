import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import { normalizePhoto } from "../../lib/marketplace/server-photo-sanitizer.ts";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("server strips EXIF and GPS while preserving valid output metadata", async () => {
  const source = await sharp({
    create: { width: 160, height: 120, channels: 4, background: { r: 70, g: 40, b: 20, alpha: 0.4 } }
  }).jpeg().withExif({ IFD0: { Make: "CameraName", Model: "PrivateModel" } }).toBuffer();
  assert.ok((await sharp(source).metadata()).exif, "test image must contain EXIF");
  const optimized = await normalizePhoto(source);
  const metadata = await sharp(optimized.bytes).metadata();
  assert.equal(metadata.format, optimized.contentType === "image/webp" ? "webp" : "jpeg");
  assert.equal(optimized.extension, optimized.contentType === "image/webp" ? "webp" : "jpg");
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
  assert.ok(optimized.bytes.byteLength <= 5 * 1024 * 1024);
});

test("server normalizes alpha PNG and keeps original dimensions", async () => {
  const source = await sharp({
    create: { width: 110, height: 60, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.2 } }
  }).png().toBuffer();
  const optimized = await normalizePhoto(source);
  const metadata = await sharp(optimized.bytes).metadata();
  assert.ok(["webp", "jpeg"].includes(metadata.format));
  assert.equal(metadata.channels, 3);
  assert.equal(metadata.width, 110);
  assert.equal(metadata.height, 60);
});

test("adaptive optimization reduces storage for a large uncompressed picture", async () => {
  const width = 640, height = 480;
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 1337;
  for (let index = 0; index < pixels.length; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels[index] = (seed >>> 16) & 255;
  }
  const source = await sharp(pixels, { raw: { width, height, channels: 3 } })
    .png().toBuffer();
  const optimized = await normalizePhoto(source);
  const metadata = await sharp(optimized.bytes).metadata();
  assert.ok(optimized.bytes.byteLength < source.byteLength);
  assert.equal(optimized.sourceBytes, source.byteLength);
  assert.ok(optimized.bytes.byteLength <= 5 * 1024 * 1024);
  assert.ok(["image/jpeg", "image/webp"].includes(optimized.contentType));
  assert.equal(metadata.width, width);
  assert.equal(metadata.height, height);
  assert.equal(metadata.exif, undefined);
});

test("server rejects malformed input", async () => {
  await assert.rejects(normalizePhoto(Buffer.from("not a real image")));
});

test("upload API verifies session and ownership before writing optimized pixels", () => {
  const route = read("app/api/uploads/sanitized-photo/route.ts");
  assert.match(route, /auth.getUser\(\)/);
  assert.match(route, /listing.seller_id !== user.id/);
  assert.match(route, /conversation.buyer_id !== user.id && conversation.seller_id !== user.id/);
  assert.match(route, /normalizePhoto\(Buffer.from\(await file.arrayBuffer\(\)\)\)/);
  assert.match(route, /admin.storage.from\(bucket\)/);
  assert.match(route, /randomUUID\(\)/);
  assert.match(route, /optimized.extension/);
  assert.match(route, /optimized.contentType/);
  assert.match(route, /upload\(path, optimized.bytes/);
  assert.doesNotMatch(route, /file.name.split/);
});

test("forms use the server sanitizer, while chat documents retain direct storage access", () => {
  for (const path of [
    "components/marketplace/new-listing-form.tsx",
    "components/marketplace/edit-listing-form.tsx",
    "components/messages/send-message-form.tsx",
  ]) {
    assert.match(read(path), /uploadSanitizedPhoto/);
  }
  const policy = read("supabase/migrations/20261107233000_server_photo_upload_policies.sql");
  assert.match(policy, /DROP POLICY IF EXISTS "listing photo uploads stay in own user folder"/);
  assert.match(policy, /conversation participants may upload documents only/);
  assert.match(policy, /lower\(storage.extension\(name\)\) IN \('pdf','doc','docx'\)/);
});

test("browser and server enforce a request size below Vercel's 4.5 MB limit", () => {
  const browser = read("lib/marketplace/photo-sanitizer.ts");
  const server = read("app/api/uploads/sanitized-photo/route.ts");
  assert.match(browser, /MAX_UPLOAD_TRANSFER_BYTES = 4 \* 1024 \* 1024/);
  assert.match(browser, /encoded.size <= MAX_UPLOAD_TRANSFER_BYTES/);
  assert.match(server, /MAX_SOURCE_BYTES = 4 \* 1024 \* 1024/);
  assert.match(server, /file.size > MAX_SOURCE_BYTES/);
  assert.match(browser, /MAX_LISTING_IMAGE_BYTES = 5 \* 1024 \* 1024/);
});
