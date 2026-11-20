import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const file = "scripts/pilot-anon-select-postgrest-pg17.py";
const source = readFileSync(file, "utf8");
const rollback = readFileSync("scripts/pilot-anon-select-rollback-local-only.sql","utf8");
const critical = readFileSync(".github/workflows/contracts.yml", "utf8");
const pg17 = readFileSync(".github/workflows/pilot-synthetic-db-storage-recovery.yml", "utf8");
const tables = ["agreements", "demand_requests", "profiles", "saved_searches", "schools"];

test("PostgREST test only reaches named local PG17 and local HTTP", () => {
  assert.match(source, /Refusing nonlocal\/non-disposable PostgreSQL/);
  assert.match(source, /parts\.hostname not in \("localhost", "127\.0\.0\.1", "::1"\)/);
  assert.match(source, /parts\.path != "\/" \+ SOURCE_DB/);
  assert.match(source, /local_only_password/);
  assert.match(source, /Refusing to overwrite existing QA database/);
  assert.match(source, /"127\.0\.0\.1"/);
  assert.match(source, /"--network", "host"/);
  assert.match(source, /"docker", "rm", "-f"/);
  assert.match(source, /drop database if exists/);
  assert.match(source, /pilot-anon-select-wave1-local-only\.sql/);
  assert.doesNotMatch(source, /supabase\.co|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL/i);
  const parsed = spawnSync("python3", ["-c",
    "import ast,pathlib;ast.parse(pathlib.Path('" + file + "').read_text())"],
    { encoding:"utf8", timeout:5000 });
  assert.equal(parsed.status, 0, parsed.stderr);
});

test("HTTP test checks guest before/after, separate signed owner and non-owner RLS", () => {
  for (const table of tables) assert.ok(source.includes('"' + table + '"'));
  assert.match(source, /check_rows\(expected_revoke=False\)/);
  assert.match(source, /check_rows\(expected_revoke=True\)/);
  assert.match(source, /guest\.get\("code"\)\s*!=\s*"42501"/);
  assert.match(source, /status\s+not\s+in\s+\(401,\s*403\)/);
  assert.match(source, /signed_user_jwt\(OWNER\)/);
  assert.match(source, /signed_user_jwt\(OTHER\)/);
  assert.match(source, /len\(result\)\s*!=\s*1/);
  assert.match(source, /request\.jwt\.claims/);
  assert.match(source, /enable row level security/);
  assert.match(source, /create view public\.demand_opportunities_30d/);
  assert.match(source, /security_invoker = true/);
  assert.match(source, /Guest invoker-view dependency not denied/);
  assert.match(source, /Authorized invoker-view regression/);
  assert.match(source, /ROLLBACK = Path/);
  assert.match(source, /pilot-anon-select-rollback-local-only\.sql/);
  assert.match(source, /def acl_fingerprint\(\):/);
  assert.match(source, /matrix_before = acl_fingerprint\(\)/);
  assert.match(source, /matrix_revoked = acl_fingerprint\(\)/);
  assert.match(source, /matrix_restored = acl_fingerprint\(\)/);
  assert.match(source, /Rollback blocked: anon already has SELECT/);
  assert.match(source, /matrix_restored != matrix_before/);

  assert.match(source, /grant insert,update,delete on public/);
  assert.match(source, /grant maintain on public/);
  assert.match(source, /grant all privileges on public/);
  assert.match(source, /def assert_anon_insert_denied\(table\):/);
  assert.match(source, /assert_anon_insert_denied\(table\)/);
  assert.match(source, /Synthetic data altered by rejected anonymous POST/);
  assert.match(source, /Local synthetic baseline does not match/);
  assert.match(source, /'maintain', has_table_privilege/);
  assert.match(source, /'truncate', has_table_privilege/);

  assert.match(source, /check_rows\(expected_revoke=False\)/);
  assert.match(source, /check_rows\(expected_revoke=True\)/);
  assert.match(source, /42501 -> 200\/empty/);

  assert.match(source, /IMAGE\s*=\s*"postgrest\/postgrest:v[0-9]/);
});

test("compensating GRANT is fail-closed in named local DB and NEVER production-ready",()=>{
  assert.match(rollback,/NOT a migration or authorization for hosted Supabase/);
  assert.match(rollback,/current_database\(\) <> 'wetudy_pilot_anon_select_wave1'/);
  assert.match(rollback,/Refusing rollback outside disposable named PG17 QA database/);
  assert.match(rollback,/Rollback blocked: anon already has SELECT on/);
  assert.match(rollback,/Rollback blocked: anonymous SELECT policy drift/);
  assert.match(rollback,/has_table_privilege\('authenticated',object_oid,'SELECT'\)/);
  assert.match(rollback,/has_table_privilege\('service_role',object_oid,'SELECT'\)/);
  assert.match(rollback,/GRANT SELECT ON TABLE/);
  assert.match(rollback,/TO anon;/);
  assert.match(rollback,/COMMIT;/);
  for(const table of tables)assert.ok(rollback.includes("public."+table));
  const code=rollback.split("\n").filter(l=>!l.trimStart().startsWith("--")).join("\n");
  assert.doesNotMatch(code,/\b(?:DROP|ALTER|CREATE|TRUNCATE|INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(code,/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)/i);
  assert.doesNotMatch(rollback,/\.supabase\.co|https:\/\/(?:www\.)?wetudy\.com/i);
  assert.ok(pg17.includes('"scripts/pilot-anon-select-rollback-local-only.sql"'));
  assert.match(source,/psql\(test_url, file=ROLLBACK\)/);
  assert.match(source,/matrix_restored != matrix_before/);
});

test("static critical guard and isolated PG17 workflow both exercise new HTTP probe", () => {
  assert.ok(critical.includes("node --test __tests__/launch/pilot-anon-select-postgrest-local-only.test.mjs"));
  assert.ok(pg17.includes('"scripts/pilot-anon-select-postgrest-pg17.py"'));
  assert.ok(pg17.includes('"__tests__/launch/pilot-anon-select-postgrest-local-only.test.mjs"'));
  assert.ok(pg17.includes("python3 scripts/pilot-anon-select-postgrest-pg17.py"));
  assert.match(pg17, /image: postgres:17/);
  assert.match(pg17, /127\.0\.0\.1:5432\/wetudy_pilot_dr_source/);
});
