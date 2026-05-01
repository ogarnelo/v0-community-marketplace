import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function walk(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

test("API route handlers expose at least one HTTP method", () => {
  const routes = walk("app/api").filter((file) => file.endsWith("/route.ts") || file.endsWith("/route.tsx"));
  assert.ok(routes.length >= 35, `Expected at least 35 API routes, got ${routes.length}`);

  for (const route of routes) {
    const source = fs.readFileSync(path.join(root, route), "utf8");
    assert.match(
      source,
      /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)|export\s+\{\s*(GET|POST|PUT|PATCH|DELETE)/,
      `${route} does not export an HTTP method`
    );
  }
});

test("page files use default export", () => {
  const pages = walk("app").filter((file) => file.endsWith("/page.tsx") || file.endsWith("/page.ts"));
  assert.ok(pages.length >= 40, `Expected at least 40 pages, got ${pages.length}`);

  for (const page of pages) {
    const source = fs.readFileSync(path.join(root, page), "utf8");
    assert.match(source, /export\s+default/, `${page} should have a default export`);
  }
});
