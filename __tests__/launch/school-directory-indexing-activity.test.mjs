import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = (path) =>
  readFileSync(new URL("../../" + path, import.meta.url), "utf8");

const compiled = ts.transpileModule(read("lib/schools/directory-public.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const SCHOOL = "11111111-1111-4111-8111-111111111111";
const REAL_OFFER = { id: "22222222-2222-4222-8222-222222222222", title: "Calculadora científica Casio" };
const DEMO_OFFER = { id: "d0000000-0000-4000-8000-111111111111", title: "Demo · Libro escolar" };

function mockDirectory({
  listed = true,
  community = true,
  active = true,
  seo = true,
  offers = [REAL_OFFER],
  listingError = false,
} = {}) {
  const calls = [];
  const storedCentre = {
    official_code: "36006122",
    name: "CEIP Ejemplo",
    linked_school_id: community ? SCHOOL : null,
    seo_indexable: seo,
  };
  const mockDb = {
    from(table) {
      calls.push(["table", table]);
      const builder = {
        select() { return this; },
        eq(col, value) { calls.push(["eq", table, col, value]); return this; },
        order() { return this; },
        limit() { return this; },
        async maybeSingle() {
          if (table === "school_directory") return { data: listed ? storedCentre : null, error: null };
          if (table === "schools") return { data: active ? { id: SCHOOL } : null, error: null };
          throw Error("Unexpected table maybeSingle: " + table);
        },
        then(resolve, reject) {
          if (table !== "listings") throw Error("Unexpected list: " + table);
          const result = listingError
            ? { data: null, error: { message: "database temporarily unavailable" } }
            : { data: offers, error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    module: mod, exports: mod.exports,
    console: { error() {} },
    require(name) {
      if (name === "react") return { cache: (fn) => fn };
      if (name === "@/lib/supabase/admin") return { createAdminClient: () => mockDb };
      if (name === "@/lib/schools/directory-identity")
        return { validOfficialSchoolCode: (code) => /^[0-9]{8}$/.test(code) };
      if (name === "@/lib/seo/demo-listing")
        return { isDemoListing: ({ id, title }) =>
          (id || "").startsWith("d0000000-0000-4000-8000-") || /^demo\s*[·:—-]/i.test(title || "") };
      throw Error("Unexpected dependency: " + name);
    },
  });
  return {
    get: mod.exports.getPublicDirectorySchool,
    calls,
  };
}

test("unlisted or malformed school cannot generate any public SEO content", async () => {
  const app = mockDirectory({ listed: false });
  assert.equal(await app.get("36006122"), null);
  assert.equal(await app.get("bad"), null);
  assert.deepEqual(app.calls.filter((c) => c[1] === "listings"), []);
});

test("directory-only school remains noindex even if SEO flag was mistakenly enabled", async () => {
  const app = mockDirectory({ community: false });
  const data = await app.get("36006122");
  assert.equal(data.verified_community, false);
  assert.equal(data.can_index, false);
  assert.equal(data.available_material.length, 0);
  assert.ok(!app.calls.some(([op,table]) => op === "table" && table === "listings"));
});

test("unverified or inactive community never enables SEO", async () => {
  const app = mockDirectory({ active: false });
  const data = await app.get("36006122");
  assert.equal(data.can_index, false);
  assert.ok(!app.calls.some(([op,table]) => op === "table" && table === "listings"));
  assert.ok(app.calls.some(([op,table,col,value]) =>
    op === "eq" && table === "schools" && col === "is_test" && value === false));
});

test("SEO remains opt-in even for a community with real stock", async () => {
  const app = mockDirectory({ seo: false });
  const data = await app.get("36006122");
  assert.equal(data.verified_community, true);
  assert.equal(data.can_index, false);
  assert.equal(data.available_material.length, 0);
  assert.ok(!app.calls.some(([op,table]) => op === "table" && table === "listings"));
});

test("manual approval + live school + real stock makes page index eligible", async () => {
  const app = mockDirectory();
  const data = await app.get("36006122");
  assert.equal(data.can_index, true);
  assert.equal(data.available_material.length, 1);
  assert.equal(data.available_material[0].title, REAL_OFFER.title);
  assert.ok(app.calls.some(([op,table,col,value]) =>
    op === "eq" && table === "listings" && col === "status" && value === "available"));
  assert.ok(app.calls.some(([op,table,col,value]) =>
    op === "eq" && table === "listings" && col === "school_id" && value === SCHOOL));
});

test("demo-only stock never unlocks Google indexing", async () => {
  const app = mockDirectory({ offers: [DEMO_OFFER, { id: "44444444-4444-4444-8444-444444444444", title: "Demo - Mochila" }] });
  const data = await app.get("36006122");
  assert.equal(data.can_index, false);
  assert.equal(data.available_material.length, 0);
});

test("mixed real and demo stock only displays real material", async () => {
  const app = mockDirectory({ offers: [DEMO_OFFER, REAL_OFFER] });
  const data = await app.get("36006122");
  assert.equal(data.can_index, true);
  assert.equal(data.available_material.length, 1);
  assert.equal(data.available_material[0].title, REAL_OFFER.title);
});

test("database failure checking real listings conservatively keeps noindex", async () => {
  const app = mockDirectory({ listingError: true });
  const data = await app.get("36006122");
  assert.equal(data.can_index, false);
  assert.equal(data.available_material.length, 0);
});

test("indexable centre page shows actual listings, not fabricated statistics", () => {
  const page = read("app/centros/[code]/page.tsx");
  assert.match(page, /robots: \{ index: centre\.can_index, follow: true \}/);
  assert.match(page, /centre\.available_material\.length > 0/);
  assert.match(page, /marketplace\/listing/);
  assert.doesNotMatch(page, /12\.847|4\.231|186\.430/);
});
