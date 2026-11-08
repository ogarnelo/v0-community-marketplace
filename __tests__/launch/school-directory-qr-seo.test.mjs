import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import {
  getWetudyDirectoryCode,
  getSchoolDirectoryUrl,
  validOfficialSchoolCode,
} from "../../lib/schools/directory-identity.ts";

const source = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("every official code has a stable public Wetudy code and QR landing URL", () => {
  assert.equal(getWetudyDirectoryCode("36006122"), "WET-36006122");
  assert.equal(getSchoolDirectoryUrl("36006122"), "https://www.wetudy.com/centros/36006122");
  assert.notEqual(getWetudyDirectoryCode("36006122"), getWetudyDirectoryCode("36006123"));
  assert.equal(validOfficialSchoolCode("36006122"), true);
  for (const wrong of ["", "bad", "3600/622", "123456789", "3600612", "36006122?admin=1"]) {
    assert.equal(validOfficialSchoolCode(wrong), false, wrong);
    assert.throws(() => getSchoolDirectoryUrl(wrong));
  }
});

test("QR endpoint generates images only for approved directory centres, without invitation tokens", async () => {
  const route = source("app/api/school-directory/[code]/qr/route.ts");
  const compiled = ts.transpileModule(route, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const generated = [];
  let listed = true;
  class ResponseStub {
    constructor(body, options = {}) {
      this.body = body;
      this.status = options.status || 200;
      this.headers = options.headers || {};
    }
  }
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    URL, Uint8Array, module, exports: module.exports,
    console: { error() {} },
    require(name) {
      if (name === "next/server") return { NextResponse: ResponseStub };
      if (name === "qrcode") return { __esModule: true, default: {
        async toString(url) { generated.push(["svg", url]); return "<svg />"; },
        async toBuffer(url) { generated.push(["png", url]); return new Uint8Array([137,80,78,71]); },
      } };
      if (name === "@/lib/schools/directory-public") {
        return { getPublicDirectorySchool: async (code) =>
          listed && code === "36006122" ? { official_code: code } : null };
      }
      if (name === "@/lib/schools/directory-identity") return { getSchoolDirectoryUrl };
      throw new Error("Unexpected dependency: " + name);
    },
  });

  const get = (code, qs = "") =>
    module.exports.GET({ url: "https://wetudy.test/api/school-directory/" + code + "/qr" + qs },
      { params: Promise.resolve({ code }) });

  let res = await get("36006122");
  assert.equal(res.status, 200);
  assert.equal(res.headers["Content-Type"], "image/svg+xml; charset=utf-8");
  assert.deepEqual(generated.at(-1), ["svg", "https://www.wetudy.com/centros/36006122"]);
  res = await get("36006122", "?format=png&download=1");
  assert.equal(res.status, 200);
  assert.equal(res.headers["Content-Type"], "image/png");
  assert.match(res.headers["Content-Disposition"], /^attachment;/);
  assert.deepEqual(generated.at(-1), ["png", "https://www.wetudy.com/centros/36006122"]);
  listed = false;
  const before = generated.length;
  res = await get("36006122");
  assert.equal(res.status, 404);
  assert.equal(generated.length, before);
  res = await get("invalid");
  assert.equal(res.status, 404);
  assert.equal(generated.length, before);
  assert.doesNotMatch(route, /school_access_codes|onboarding\/join-school|service_role_key/);
});

test("SEO is manual, published-only, verified non-test school; otherwise noindex", () => {
  const schema = source("supabase/migrations/20261107235900_school_directory_catalog.sql");
  const loader = source("lib/schools/directory-public.ts");
  const page = source("app/centros/[code]/page.tsx");
  const listing = source("app/centros/page.tsx");
  assert.match(schema, /seo_indexable boolean NOT NULL DEFAULT false/);
  assert.match(schema, /is_listed boolean NOT NULL DEFAULT false/);
  assert.match(loader, /\.eq\("is_listed", true\)/);
  assert.match(loader, /\.eq\("is_test", false\)/);
  assert.match(loader, /\.eq\("is_active", true\)/);
  assert.match(loader, /can_index: Boolean\(data\.seo_indexable && verifiedCommunity && availableMaterial\.length > 0\)/);
  assert.match(page, /robots: \{ index: centre\.can_index, follow: true \}/);
  assert.match(page, /getWetudyDirectoryCode/);
  assert.match(page, /api\/school-directory\/\$\{centre\.official_code\}\/qr/);
  assert.match(page, /getSchoolDirectoryUrl\(centre\.official_code\)/);
  assert.match(listing, /Ver ficha y QR del centro/);
  assert.match(listing, /getWetudyDirectoryCode/);
});

test("existing authenticated AMPA QR and access codes stay unchanged", () => {
  const current = source("app/api/school/share-qr/route.ts");
  assert.match(current, /school_admin/);
  assert.match(current, /onboarding\/join-school/);
  assert.match(current, /QRCode\.toBuffer/);
});
