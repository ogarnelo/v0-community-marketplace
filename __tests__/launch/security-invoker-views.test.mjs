import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SEARCH_DIRS = [
  "supabase/migrations",
  "docs/sql",
  "scripts/sql",
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }

  return out;
}

function normalizeSql(sql) {
  return sql
    .toLowerCase()
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

test("demand intelligence views are explicitly moved to security_invoker", () => {
  const files = SEARCH_DIRS.flatMap((dir) => walk(dir)).filter((file) => file.endsWith(".sql"));

  assert.ok(
    files.length > 0,
    `Expected at least one versioned SQL file in one of: ${SEARCH_DIRS.join(", ")}`
  );

  const combined = normalizeSql(files.map((file) => fs.readFileSync(file, "utf8")).join("\n"));

  for (const viewName of [
    "demand_opportunities_30d",
    "demand_activation_opportunities_30d",
    "demand_events_30d_summary",
  ]) {
    const pattern = new RegExp(
      `alter\\s+view\\s+public\\.${viewName}\\s+set\\s*\\(\\s*security_invoker\\s*=\\s*true\\s*\\)`
    );

    assert.match(
      combined,
      pattern,
      `public.${viewName} must be altered to security_invoker=true`
    );
  }
});
