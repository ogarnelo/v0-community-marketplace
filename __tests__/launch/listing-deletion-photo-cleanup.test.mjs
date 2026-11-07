import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const compile = (path) => ts.transpileModule(read(path), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const LISTING = "33333333-3333-4333-8333-333333333333";
const IMAGE = "55555555-5555-4555-8555-555555555555.webp";
const ROOT = "https://storage.example/storage/v1/object/public/listing-photos/";
const pathOf = (location, name = IMAGE) => USER + "/" + location + "/" + name;
const urlOf = (path) => ROOT + path;
const listingPhotoPath = pathOf(LISTING);
const draftPhotoPath = pathOf("drafts/current");

function makeCleanupApp({ referencedBy = [], lookupError = "", removeError = false } = {}) {
  const events = [];
  const admin = {
    from(table) {
      return {
        selector: "",
        select() { return this; },
        eq(field, value) { this.selector = field + ":" + value; return this; },
        contains(column, value) {
          assert.equal(column, "photos");
          this.selector = JSON.stringify(value);
          return this;
        },
        limit() { return this; },
        async maybeSingle() {
          events.push("check:" + table + ":" + this.selector);
          const match = referencedBy.includes(table) ||
            (referencedBy.includes("draftPath") &&
            table === "listing_drafts" && this.selector.includes('"path"'));
          return { data: match ? { id: "still-linked" } : null,
            error: lookupError === table ? { message: "simulated lookup failure" } : null };
        },
      };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "listing-photos");
        return {
          getPublicUrl(name) { return { data: { publicUrl: urlOf(name) } }; },
          async remove(paths) {
            events.push({ remove: [...paths] });
            return { error: removeError ? { message: "simulated storage failure" } : null };
          },
        };
      },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compile("lib/marketplace/cleanup-deleted-listing-photos.ts"), {
    module, exports: module.exports, require(name) {
      throw new Error("Unexpected runtime require: " + name);
    }, URL, console: { error() {} },
  });
  const cleanup = (urls) => module.exports.cleanupDeletedListingPhotos(admin, {
    ownerId: USER, listingId: LISTING, urls,
  });
  return { events, cleanup };
}

test("unreferenced owner photo is removed once after reference checks", async () => {
  const app = makeCleanupApp();
  await app.cleanup([urlOf(listingPhotoPath), urlOf(listingPhotoPath)]);
  assert.equal(app.events.filter((e) => typeof e === "object").length, 1);
  assert.deepEqual(app.events.at(-1).remove, [listingPhotoPath]);
  assert.equal(app.events.filter((e) => typeof e === "string").length, 4);
});

test("staged draft photo is removable after listing deletion only when no references remain", async () => {
  const app = makeCleanupApp();
  await app.cleanup([urlOf(draftPhotoPath)]);
  assert.deepEqual(app.events.at(-1).remove, [draftPhotoPath]);
});

for (const ref of ["listings", "listing_photos", "listing_drafts", "draftPath"]) {
  test("do not remove photo still linked by " + ref, async () => {
    const app = makeCleanupApp({ referencedBy: [ref] });
    await app.cleanup([urlOf(listingPhotoPath)]);
    assert.equal(app.events.some((e) => typeof e === "object"), false);
  });
}

for (const table of ["listings", "listing_photos", "listing_drafts"]) {
  test("lookup failure in " + table + " preserves file rather than risking data loss", async () => {
    const app = makeCleanupApp({ lookupError: table });
    await app.cleanup([urlOf(listingPhotoPath)]);
    assert.equal(app.events.some((e) => typeof e === "object"), false);
  });
}

test("foreign, unrelated, path-traversal, URL-query and legacy photos are never deleted", async () => {
  const app = makeCleanupApp();
  await app.cleanup([
    "https://evil.example/" + listingPhotoPath,
    urlOf(OTHER + "/" + LISTING + "/" + IMAGE),
    urlOf(USER + "/" + OTHER + "/" + IMAGE),
    urlOf(USER + "/drafts/other/" + IMAGE),
    urlOf(USER + "/" + LISTING + "/../" + IMAGE),
    urlOf(listingPhotoPath) + "?x=123",
    urlOf(USER + "/" + LISTING + "/old-photo-name.png"),
  ]);
  assert.equal(app.events.length, 0);
});

test("storage removal error never makes an already deleted listing fail", async () => {
  const app = makeCleanupApp({ removeError: true });
  await assert.doesNotReject(app.cleanup([urlOf(listingPhotoPath)]));
});

function makeDeleteApp({
  authenticated = true, owner = USER, history = false,
  deleteError = false, deletedRow = true, photoQueryError = false,
} = {}) {
  const events = [];
  const payload = { listingId: LISTING };
  const admin = {
    from(table) {
      const query = {
        operation: "read",
        select(columns) { this.columns = columns; return this; },
        delete() { this.operation = "delete"; return this; },
        update(data) { this.operation = "update"; this.updates = data; return this; },
        eq() { return this; },
        in() { return this; },
        limit() { return this; },
        async maybeSingle() {
          if (table === "listings") {
            if (this.operation === "delete") {
              events.push("listing.delete");
              return {
                data: !deleteError && deletedRow ? { id: LISTING } : null,
                error: deleteError ? { message: "simulated FK failure" } : null,
              };
            }
            return { data: { id: LISTING, seller_id: owner, photos: [urlOf(listingPhotoPath)], status: "active" },
              error: null };
          }
          if (table === "listing_offers" || table === "donation_requests")
            return { data: null, error: null };
          throw new Error("Unexpected maybeSingle " + table);
        },
        then(resolve, reject) {
          if (table === "listings" && this.operation === "update") {
            events.push("listing.archive");
            return Promise.resolve({ error: null }).then(resolve, reject);
          }
          if (table === "listing_photos") {
            events.push("photos.snapshot");
            return Promise.resolve({
              data: photoQueryError ? null : [{ url: urlOf(listingPhotoPath) }],
              error: photoQueryError ? { message: "photo query unavailable" } : null,
            }).then(resolve, reject);
          }
          const data = history && (table === "conversations") ? [{ id: "conversation" }] : [];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const mod = { exports: {} };
  vm.runInNewContext(compile("app/api/listings/delete/route.ts"), {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === "next/server") return { NextResponse: { json(body, options = {}) {
        return { status: options.status || 200, body };
      } } };
      if (name === "@/lib/supabase/server") return { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: authenticated ? { id: USER } : null } }) },
      }) };
      if (name === "@/lib/supabase/admin") return { createAdminClient: () => admin };
      if (name === "@/lib/marketplace/cleanup-deleted-listing-photos") {
        return { cleanupDeletedListingPhotos: async (_admin, params) => {
          events.push("storage.cleanup");
          assert.equal(params.ownerId, USER);
          assert.equal(params.listingId, LISTING);
          assert.ok(params.urls.includes(urlOf(listingPhotoPath)));
        } };
      }
      throw new Error("Unexpected route require: " + name);
    },
    console: { error() {} },
  });
  return { events, post: () => mod.exports.POST({ json: async () => payload }) };
}

test("photo cleanup runs only AFTER confirmed database deletion", async () => {
  const app = makeDeleteApp();
  const result = await app.post();
  assert.equal(result.status, 200);
  assert.equal(result.body.mode, "deleted");
  assert.ok(app.events.indexOf("listing.delete") < app.events.indexOf("storage.cleanup"));
});

test("database delete failure archives without removing photos", async () => {
  const app = makeDeleteApp({ deleteError: true });
  const result = await app.post();
  assert.equal(result.body.mode, "archived");
  assert.ok(!app.events.includes("storage.cleanup"));
});

test("row already gone never triggers physical deletion", async () => {
  const app = makeDeleteApp({ deletedRow: false });
  assert.equal((await app.post()).status, 409);
  assert.ok(!app.events.includes("storage.cleanup"));
});

test("listing with conversation history archives and preserves photos", async () => {
  const app = makeDeleteApp({ history: true });
  assert.equal((await app.post()).body.mode, "archived");
  assert.ok(!app.events.includes("storage.cleanup"));
});

test("unauthorized deletion cannot remove photographs", async () => {
  const app = makeDeleteApp({ owner: OTHER });
  assert.equal((await app.post()).status, 403);
  assert.equal(app.events.length, 0);
});

test("failure to gather photo URLs prevents cleanup but not DB removal", async () => {
  const app = makeDeleteApp({ photoQueryError: true });
  assert.equal((await app.post()).body.mode, "deleted");
  assert.ok(!app.events.includes("storage.cleanup"));
});
