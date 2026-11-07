import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import { normalizePhoto } from "../../lib/marketplace/server-photo-sanitizer.ts";

const read=(path)=>readFileSync(new URL(`../../${path}`,import.meta.url),"utf8");

test("server re-encodes image to JPEG stripping source EXIF and original metadata", async()=>{
  const source = await sharp({
    create: { width: 160, height: 120, channels: 4, background: { r: 70, g: 40, b: 20, alpha: 0.4 } }
  }).jpeg().withExif({ IFD0: { Make: "CameraName", Model: "PrivateModel" } }).toBuffer();
  assert.ok((await sharp(source).metadata()).exif, "fixture must contain EXIF");
  const clean=await normalizePhoto(source);
  const meta=await sharp(clean).metadata();
  assert.equal(meta.format,"jpeg");
  assert.equal(meta.exif,undefined);
  assert.equal(meta.xmp,undefined);
  assert.ok(clean.byteLength <= 5*1024*1024);
});
test("server normalizes PNG into JPEG and removes alpha", async()=>{
  const source=await sharp({
    create: { width: 110, height: 60, channels: 4, background: { r: 10,g: 20,b: 30,alpha:0.2 }}
  }).png().toBuffer();
  const result=await sharp(await normalizePhoto(source)).metadata();
  assert.equal(result.format,"jpeg");
  assert.equal(result.channels,3);
});
test("server rejects invalid or suspicious image bytes", async()=>{
  await assert.rejects(normalizePhoto(Buffer.from("not a real image")));
});
test("upload API authenticates and authorizes destination before writing",()=>{
  const route=read("app/api/uploads/sanitized-photo/route.ts");
  assert.match(route,/auth.getUser\(\)/);
  assert.match(route,/listing.seller_id !== user.id/);
  assert.match(route,/conversation.buyer_id !== user.id && conversation.seller_id !== user.id/);
  assert.match(route,/normalizePhoto\(Buffer.from\(await file.arrayBuffer\(\)\)\)/);
  assert.match(route,/admin.storage.from\(bucket\)/);
  assert.match(route,/randomUUID\(\)/);
  assert.match(route,/claim_photo_upload_slot/);
  assert.match(route,/p_user_id: user.id/);
  assert.match(route,/status: 429/);
  assert.doesNotMatch(route,/file.name\.split/);
});
test("all image upload UI paths go through server (documents may stay direct)",()=>{
  for(const path of [
    "components/marketplace/new-listing-form.tsx",
    "components/marketplace/edit-listing-form.tsx",
    "components/messages/send-message-form.tsx",
  ]){
    const source=read(path);
    assert.match(source,/uploadSanitizedPhoto/);
  }
  const photoPolicy=read("supabase/migrations/20261107233000_server_photo_upload_policies.sql");
  assert.match(photoPolicy,/DROP POLICY IF EXISTS "listing photo uploads stay in own user folder"/);
  assert.match(photoPolicy,/conversation participants may upload documents only/);
  assert.match(photoPolicy,/lower\(storage.extension\(name\)\) IN \('pdf','doc','docx'\)/);
  assert.match(photoPolicy,/COALESCE\(metadata ->> 'mimetype'/);
});

test("quota limits are atomic and cannot be invoked by clients", () => {
  const sql = read("supabase/migrations/20261107235000_photo_upload_rate_limit.sql");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /recent_10_minutes >= 12/);
  assert.match(sql, /recent_24_hours >= 60/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.claim_photo_upload_slot/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public.claim_photo_upload_slot/);
});
