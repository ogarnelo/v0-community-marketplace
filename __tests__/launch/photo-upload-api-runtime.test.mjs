import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const raw = readFileSync(new URL("../../app/api/uploads/sanitized-photo/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(raw, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const LISTING = "33333333-3333-4333-8333-333333333333";
const CONVERSATION = "44444444-4444-4444-8444-444444444444";

function fixture({
  authenticated = true,
  destination = "listing",
  resourceId = LISTING,
  fileType = "image/jpeg",
  fileBytes = Buffer.from("fake-image"),
  listingOwner = USER,
  chatBuyer = USER,
  chatSeller = OTHER,
  invalidPixels = false,
  quotaAllowed = true,
} = {}) {
  const uploads = [];
  const claims = [];
  const parsed = {
    file: new File([fileBytes], "private-original-with-gps.jpg", { type: fileType }),
    destination,
    resourceId,
  };
  const admin = {
    async rpc(name, params) {
      assert.equal(name, "claim_photo_upload_slot");
      assert.equal(params.p_user_id, USER);
      claims.push(params);
      return { data: quotaAllowed, error: null };
    },
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          if (table === "listings") return { data: { seller_id: listingOwner }, error: null };
          if (table === "conversations") {
            return { data: { buyer_id: chatBuyer, seller_id: chatSeller }, error: null };
          }
          throw new Error("Unexpected database table: " + table);
        },
      };
    },
    storage: {
      from(bucket) {
        return {
          async upload(path, bytes, opts) {
            uploads.push({ bucket, path, bytes, opts });
            return { error: null };
          },
          getPublicUrl(path) {
            return { data: { publicUrl: "https://storage.example/" + path } };
          },
        };
      },
    },
  };
  const fakeRequire = (specifier) => {
    if (specifier === "next/server") {
      return { NextResponse: { json(body, options = {}) {
        return { status: options.status || 200, body };
      } } };
    }
    if (specifier === "node:crypto") return { randomUUID: () => "55555555-5555-4555-8555-555555555555" };
    if (specifier === "@/lib/supabase/server") {
      return { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: authenticated ? { id: USER } : null } }) },
      }) };
    }
    if (specifier === "@/lib/supabase/admin") return { createAdminClient: () => admin };
    if (specifier === "@/lib/marketplace/server-photo-sanitizer") {
      return { normalizePhoto: async (bytes) => {
        if (invalidPixels) throw new Error("Invalid image");
        return {
          bytes: Buffer.from("sanitized-webp"),
          extension: "webp",
          contentType: "image/webp",
          sourceBytes: bytes.byteLength,
        };
      } };
    }
    throw new Error("Unexpected import " + specifier);
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports, require: fakeRequire,
    File, Buffer, console,
  });
  const request = { formData: async () => ({ get: (key) => parsed[key] ?? null }) };
  return { uploads, claims, post: async () => module.exports.POST(request) };
}

test("unauthenticated photo requests cannot write to storage", async () => {
  const app = fixture({ authenticated: false });
  assert.equal((await app.post()).status, 401);
  assert.equal(app.uploads.length, 0);
});
test("cannot attach photos to other families' listings", async () => {
  const app = fixture({ listingOwner: OTHER });
  assert.equal((await app.post()).status, 403);
  assert.equal(app.uploads.length, 0);
});
test("cannot attach photos to conversations without participating", async () => {
  const app = fixture({ destination: "chat", resourceId: CONVERSATION,
    chatBuyer: OTHER, chatSeller: "66666666-6666-4666-8666-666666666666" });
  assert.equal((await app.post()).status, 403);
  assert.equal(app.uploads.length, 0);
});
test("allowed listing uploads store one optimized WEBP with correct path and mime", async () => {
  const app = fixture();
  const response = await app.post();
  assert.equal(response.status, 200);
  assert.equal(response.body.contentType, "image/webp");
  assert.equal(response.body.name, "55555555-5555-4555-8555-555555555555.webp");
  assert.equal(app.uploads.length, 1);
  assert.equal(app.uploads[0].bucket, "listing-photos");
  assert.equal(app.uploads[0].path,
    USER + "/" + LISTING + "/55555555-5555-4555-8555-555555555555.webp");
  assert.equal(app.uploads[0].opts.contentType, "image/webp");
  assert.equal(Buffer.from(app.uploads[0].bytes).toString(), "sanitized-webp");
});
test("allowed chat uploads use private bucket and no public URL", async () => {
  const app = fixture({ destination: "chat", resourceId: CONVERSATION });
  const response = await app.post();
  assert.equal(response.status, 200);
  assert.equal(response.body.publicUrl, null);
  assert.equal(app.uploads.length, 1);
  assert.equal(app.uploads[0].bucket, "chat-attachments");
  assert.equal(app.uploads[0].path,
    CONVERSATION + "/" + USER + "/55555555-5555-4555-8555-555555555555.webp");
});
test("new listing photos are staged before row insertion; listing-only uploads require an existing owner", async () => {
  const form = readFileSync(
    new URL("../../components/marketplace/new-listing-form.tsx", import.meta.url),
    "utf8"
  );
  const uploadFn = form.slice(
    form.indexOf("const uploadListingPhotos = async"),
    form.indexOf("const handleSubmit = async")
  );
  assert.ok(uploadFn.includes('uploadSanitizedPhoto(photo.file, "draft")'));
  assert.ok(!uploadFn.includes('uploadSanitizedPhoto(photo.file, "listing"'));
  assert.ok(form.indexOf("const uploadedPhotoRows = await uploadListingPhotos") <
    form.indexOf('supabase.from("listings").insert(payload)'));
  const staged = fixture({ destination: "draft", resourceId: "" });
  assert.equal((await staged.post()).status, 200);
  assert.equal(staged.uploads.length, 1);
  const notCreatedYet = fixture({ destination: "listing", listingOwner: null });
  assert.equal((await notCreatedYet.post()).status, 403);
  assert.equal(notCreatedYet.uploads.length, 0);
});
test("draft uploads stay in the authenticated owner's private folder", async () => {
  const app = fixture({ destination: "draft", resourceId: "" });
  const response = await app.post();
  assert.equal(response.status, 200);
  assert.equal(app.uploads[0].path,
    USER + "/drafts/current/55555555-5555-4555-8555-555555555555.webp");
});
test("reject GIF files, invalid resource IDs, and oversized requests before storage", async () => {
  for (const options of [
    { fileType: "image/gif" },
    { resourceId: "../../not-a-listing" },
    { fileBytes: Buffer.alloc(4 * 1024 * 1024 + 1) },
  ]) {
    const app = fixture(options);
    assert.ok((await app.post()).status >= 400);
    assert.equal(app.uploads.length, 0);
  }
});
test("invalid image pixels never reach storage", async () => {
  const app = fixture({ invalidPixels: true });
  assert.equal((await app.post()).status, 422);
  assert.equal(app.uploads.length, 0);
});

test("denied upload quota returns 429 without processing or storing image", async () => {
  const app = fixture({ quotaAllowed: false });
  assert.equal((await app.post()).status, 429);
  assert.equal(app.uploads.length, 0);
  assert.equal(app.claims.length, 1);
});
test("unauthorized resource and invalid formats do not consume upload slots", async () => {
  for (const options of [
    { authenticated: false },
    { listingOwner: OTHER },
    { fileType: "image/gif" },
  ]) {
    const app = fixture(options);
    assert.ok((await app.post()).status >= 400);
    assert.equal(app.claims.length, 0);
    assert.equal(app.uploads.length, 0);
  }
});
