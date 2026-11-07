import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const code = readFileSync(new URL("../../app/api/marketplace/listing-draft/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(code, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const USER = "11111111-1111-4111-8111-111111111111";
const ownPath = (id) => USER + "/drafts/current/" + id + ".webp";
const photo = (path) => ({ url: "https://storage.example/" + path, path });

function makeApp({
  authenticated = true,
  oldPhotos = [photo(ownPath("old"))],
  newPhotos = [photo(ownPath("new"))],
  upsertFailure = false,
  deleteFailure = false,
  cleanupFailure = false,
  preservePhotoPaths = [],
  publishedPhotoUrls = [],
  publishedLookupError = false,
} = {}) {
  const events = [];
  let draft = oldPhotos.map((entry) => ({ ...entry }));
  const admin = {
    from(table) {
      if (table === "listings") {
        return {
          select() { return this; },
          contains(column, urls) {
            assert.equal(column, "photos");
            this.urls = urls;
            return this;
          },
          limit() { return this; },
          async maybeSingle() {
            events.push("listing.lookup");
            return {
              data: publishedPhotoUrls.some((url) => this.urls.includes(url)) ? { id: "published" } : null,
              error: publishedLookupError ? { message: "Lookup failure" } : null,
            };
          },
        };
      }
      assert.equal(table, "listing_drafts");
      return {
        operation: null,
        select() { return this; },
        eq() { return this; },
        upsert(data) { this.operation = "upsert"; this.newData = data; return this; },
        delete() { this.operation = "delete"; return this; },
        async maybeSingle() { return { data: { photos: draft }, error: null }; },
        async single() {
          events.push("db.upsert");
          if (upsertFailure) return { data: null, error: { message: "Simulated DB error" } };
          draft = this.newData.photos;
          return { data: { id: "draft", photos: draft }, error: null };
        },
        then(resolve, reject) {
          events.push("db.delete");
          if (!deleteFailure) draft = [];
          return Promise.resolve({
            error: deleteFailure ? { message: "Simulated DB delete failure" } : null,
          }).then(resolve, reject);
        },
      };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "listing-photos");
        return {
          async remove(paths) {
            events.push("storage.remove");
            events.push({ removed: [...paths] });
            return { error: cleanupFailure ? { message: "Storage cleanup failed" } : null };
          },
        };
      },
    },
  };
  const fakeRequire = (name) => {
    if (name === "next/server") {
      return {
        NextResponse: { json(data, options = {}) {
          return { status: options.status || 200, data };
        }},
      };
    }
    if (name === "@/lib/supabase/admin") return { createAdminClient: () => admin };
    if (name === "@/lib/supabase/server") {
      return { createClient: async () => ({
        auth: { getUser: async () => ({
          data: { user: authenticated ? { id: USER } : null },
        })},
      })};
    }
    throw new Error("Unexpected import: " + name);
  };
  const mod = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module: mod, exports: mod.exports, require: fakeRequire, Buffer, console,
  });
  const route = mod.exports;
  const putRequest = { json: async () => ({ payload: { title: "Libro pruebas" }, photos: newPhotos }) };
  const deleteRequest = { json: async () => ({ preservePhotoPaths }) };
  return {
    events,
    getDraft: () => draft,
    put: () => route.PUT(putRequest),
    remove: () => route.DELETE(deleteRequest),
  };
}

test("failed draft update never deletes existing photographs", async () => {
  const app = makeApp({ upsertFailure: true });
  const response = await app.put();
  assert.equal(response.status, 500);
  assert.deepEqual(app.events, ["db.upsert"]);
  assert.equal(app.getDraft()[0].path, ownPath("old"));
});

test("successful draft update deletes old photographs only after saving", async () => {
  const app = makeApp();
  const response = await app.put();
  assert.equal(response.status, 200);
  assert.equal(app.events[0], "db.upsert");
  assert.equal(app.events[1], "listing.lookup");
  assert.equal(app.events[2], "storage.remove");
  assert.deepEqual(app.events[3].removed, [ownPath("old")]);
  assert.equal(app.getDraft()[0].path, ownPath("new"));
});

test("storage cleanup failure does not discard successfully saved draft", async () => {
  const app = makeApp({ cleanupFailure: true });
  const response = await app.put();
  assert.equal(response.status, 200);
  assert.equal(app.getDraft()[0].path, ownPath("new"));
});

test("failed draft deletion never removes linked image files", async () => {
  const app = makeApp({ deleteFailure: true });
  const response = await app.remove();
  assert.equal(response.status, 500);
  assert.deepEqual(app.events, ["db.delete"]);
  assert.equal(app.getDraft()[0].path, ownPath("old"));
});

test("successful draft deletion removes unused files after database commit", async () => {
  const app = makeApp();
  const response = await app.remove();
  assert.equal(response.status, 200);
  assert.equal(app.events[0], "db.delete");
  assert.equal(app.events[1], "listing.lookup");
  assert.equal(app.events[2], "storage.remove");
  assert.deepEqual(app.events[3].removed, [ownPath("old")]);
});

test("published photo paths are preserved when discarding draft", async () => {
  const app = makeApp({ preservePhotoPaths: [ownPath("old")] });
  const response = await app.remove();
  assert.equal(response.status, 200);
  assert.deepEqual(app.events, ["db.delete"]);
});

test("unauthenticated requests do not modify drafts or files", async () => {
  const app = makeApp({ authenticated: false });
  assert.equal((await app.put()).status, 401);
  assert.equal((await app.remove()).status, 401);
  assert.deepEqual(app.events, []);
});

test("updating a draft keeps photos already referenced by a published listing", async () => {
  const app = makeApp({ publishedPhotoUrls: [photo(ownPath("old")).url] });
  assert.equal((await app.put()).status, 200);
  assert.deepEqual(app.events, ["db.upsert", "listing.lookup"]);
});

test("discarding a draft keeps published listing photos even if preserve paths are missing", async () => {
  const app = makeApp({ publishedPhotoUrls: [photo(ownPath("old")).url] });
  assert.equal((await app.remove()).status, 200);
  assert.deepEqual(app.events, ["db.delete", "listing.lookup"]);
});

test("lookup failure preserves photographs rather than risking broken listings", async () => {
  const app = makeApp({ publishedLookupError: true });
  assert.equal((await app.remove()).status, 200);
  assert.deepEqual(app.events, ["db.delete", "listing.lookup"]);
});
