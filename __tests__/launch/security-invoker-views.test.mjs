import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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

test("demand intelligence views are explicitly moved to security_invoker", () => {
  const files = walk("supabase/migrations").filter((file) => file.endsWith(".sql"));
  const combined = files.map((file) => fs.readFileSync(file, "utf8")).join("\n").toLowerCase();

  assert.match(
    combined,
    /alter\s+view\s+public\.demand_opportunities_30d\s+set\s*\(\s*security_invoker\s*=\s*true\s*\)/,
    "public.demand_opportunities_30d must be altered to security_invoker=true"
  );

  assert.match(
    combined,
    /alter\s+view\s+public\.demand_activation_opportunities_30d\s+set\s*\(\s*security_invoker\s*=\s*true\s*\)/,
    "public.demand_activation_opportunities_30d must be altered to security_invoker=true"
  );

  assert.match(
    combined,
    /alter\s+view\s+public\.demand_events_30d_summary\s+set\s*\(\s*security_invoker\s*=\s*true\s*\)/,
    "public.demand_events_30d_summary must be altered to security_invoker=true"
  );
});
