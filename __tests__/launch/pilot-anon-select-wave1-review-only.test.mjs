import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const proposalPath = "scripts/pilot-anon-select-wave1-local-only.sql";
const runnerPath = "scripts/pilot-anon-select-wave1-pg17.py";
const contractPath = "__tests__/launch/pilot-anon-select-wave1-review-only.test.mjs";
const proposal = readFileSync(proposalPath, "utf8");
const runner = readFileSync(runnerPath, "utf8");
const workflow = readFileSync(".github/workflows/pilot-synthetic-db-storage-recovery.yml", "utf8");
const critical = readFileSync(".github/workflows/contracts.yml", "utf8");
const tables = ["agreements", "demand_requests", "profiles", "saved_searches", "schools"];

test("review SQL is locked to a named disposable DB and not a migration", () => {
  assert.match(proposal, /current_database\(\)\s*<>\s*'wetudy_pilot_anon_select_wave1'/);
  assert.match(proposal, /Refusing non-disposable database/);
  assert.match(proposal, /BEGIN;/);
  assert.match(proposal, /COMMIT;/);
  assert.equal((proposal.match(/REVOKE SELECT ON TABLE/g) || []).length, 1);
  assert.match(proposal, /FROM anon;/);
  for (const name of tables) {
    assert.match(proposal, new RegExp("public\\." + name + "\\b"));
  }
  assert.doesNotMatch(proposal, /^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|GRANT)\b/gmi);
  assert.doesNotMatch(proposal, /supabase\/migrations\//);
});

test("SQL refuses RLS drift and residual PUBLIC or column privileges", () => {
  assert.match(proposal, /relrowsecurity/);
  assert.match(proposal, /pg_policies/);
  assert.match(proposal, /'anon'\s*=\s*ANY\(p\.roles\)/);
  assert.match(proposal, /'public'\s*=\s*ANY\(p\.roles\)/);
  assert.match(proposal, /has_table_privilege\('anon'/);
  assert.match(proposal, /has_column_privilege\('anon'/);
  assert.match(proposal, /has_table_privilege\('authenticated'/);
  assert.match(proposal, /has_table_privilege\('service_role'/);
});

test("PG17 test refuses remote/source-overwrite and checks rollback and RLS", () => {
  assert.match(runner, /Refusing nonlocal\/non-disposable PostgreSQL/);
  assert.match(runner, /Refusing to overwrite existing QA database/);
  assert.match(runner, /parts\.hostname not in \("localhost", "127\.0\.0\.1", "::1"\)/);
  assert.match(runner, /parts\.path != "\/" \+ SOURCE_DB/);
  assert.match(runner, /with \(force\)/);
  assert.match(runner, /proposal\(succeeds=False\)/);
  assert.match(runner, /create policy test_anon/);
  assert.match(runner, /grant select\(owner_id\)/);
  assert.match(runner, /grant select on public\.profiles to public/);
  assert.match(runner, /visible_rows\("authenticated"/);
  assert.match(runner, /visible_rows\("anon"/);
  assert.doesNotMatch(runner, /supabase\.co|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL|https?:\/\//i);
  const check = spawnSync("python3", ["-c",
    "import ast,pathlib;ast.parse(pathlib.Path('" + runnerPath + "').read_text())"],
    { encoding:"utf8", timeout:5000 });
  assert.equal(check.status, 0, check.stderr);
});

test("mandatory critical CI and isolated PG17 workflow execute the guards", () => {
  assert.match(critical, new RegExp("node --test " + contractPath.replaceAll(".", "\\.")));
  assert.ok(workflow.includes('"' + runnerPath + '"'), "PR path must trigger PG17");
  assert.ok(workflow.includes('"' + proposalPath + '"'), "SQL path must trigger PG17");
  assert.ok(workflow.includes("python3 " + runnerPath), "PG17 must run proposal fixture");
  assert.match(workflow, /image: postgres:17/);
  assert.match(workflow, /127\.0\.0\.1:5432\/wetudy_pilot_dr_source/);
});
