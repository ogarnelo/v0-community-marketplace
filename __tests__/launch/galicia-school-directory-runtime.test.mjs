import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { getDirectorySearch, SCHOOL_DIRECTORY_PAGE_SIZE } from "../../lib/schools/directory-search.ts";

const route = readFileSync(
  new URL("../../app/api/school-directory/route.ts", import.meta.url),
  "utf8"
);
const compiled = ts.transpileModule(route, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fakeDirectory({
  records = [{ official_code: "36006122", name: "CEIP A Xunqueira Nº 1",
    municipality: "Pontevedra", province: "Pontevedra" }],
  count = 1624,
  fails = false,
} = {}) {
  const operations = [];
  const admin = {
    from(table) {
      operations.push(["from", table]);
      const builder = {
        select(cols, options) { operations.push(["select", cols, options]); return this; },
        eq(col, value) { operations.push(["eq", col, value]); return this; },
        ilike(col, value) { operations.push(["ilike", col, value]); return this; },
        order(col, options) { operations.push(["order", col, options]); return this; },
        range(first,last) { operations.push(["range", first, last]); return this; },
        async returns() {
          return fails
            ? { data: null, count: null, error: { message: "database unavailable" } }
            : { data: records, count, error: null };
        },
      };
      return builder;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    URL,
    console: { error() {} },
    require(name) {
      if (name === "next/server") {
        return { NextResponse: { json(body, options = {}) {
          return { status: options.status || 200, body, headers: options.headers };
        } } };
      }
      if (name === "@/lib/supabase/admin") {
        return { createAdminClient: () => admin };
      }
      if (name === "@/lib/schools/directory-search") {
        return { getDirectorySearch, SCHOOL_DIRECTORY_PAGE_SIZE };
      }
      throw new Error("Unexpected import: " + name);
    },
  });
  const get = (query = "") =>
    module.exports.GET({ url: "https://wetudy.example/api/school-directory?" + query });
  return { get, operations };
}

test("public directory API requires publication approval and uses a fixed page size", async () => {
  const app = fakeDirectory();
  const response = await app.get("page=2");
  assert.equal(response.status, 200);
  assert.equal(response.body.page, 2);
  assert.equal(response.body.pageSize, 24);
  assert.equal(response.body.total, 1624);
  assert.equal(response.body.centres[0].official_code, "36006122");
  assert.ok(app.operations.some(([op,col,value]) => op === "eq" && col === "is_listed" && value === true));
  assert.ok(app.operations.some(([op,first,last]) => op === "range" && first === 24 && last === 47));
  assert.ok(app.operations.some(([op,cols]) => op === "select" && !cols.includes("linked_school_id")));
  assert.ok(app.operations.some(([op,cols]) => op === "select" && !cols.includes("phone")));
});

test("school search applies province and escaped literal query", async () => {
  const app = fakeDirectory();
  assert.equal((await app.get("province=Pontevedra&q=CEIP")).status, 200);
  assert.ok(app.operations.some(([op,col,value]) => op === "eq" && col === "province" && value === "Pontevedra"));
  const national = fakeDirectory();
  assert.equal((await national.get("community=Comunidad+de+Madrid&province=Madrid")).status, 200);
  assert.ok(national.operations.some(([op,col,value]) => op === "eq" && col === "autonomous_community" && value === "Comunidad de Madrid"));
  assert.ok(app.operations.some(([op,col,value]) => op === "ilike" && col === "search_text" && value === "%ceip%"));
});

test("invalid user inputs are rejected before touching the database", async () => {
  for (const value of ["community=Atlantis", "province=Malaga%40foo", "page=2001", "q=" + "x".repeat(100)]) {
    const app = fakeDirectory();
    const result = await app.get(value);
    assert.equal(result.status, 400);
    assert.equal(app.operations.length, 0);
  }
});

test("database error fails closed without leaking query details", async () => {
  const app = fakeDirectory({ fails: true });
  const result = await app.get("q=Pontevedra");
  assert.equal(result.status, 503);
  assert.equal(result.body.error, "No se pudo consultar el directorio.");
});
