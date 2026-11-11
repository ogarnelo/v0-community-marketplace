import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const file="supabase/migrations/20261111084000_pilot_wave1_revoke_client_non_rls_privileges.sql";
const migration=readFileSync(file,"utf8");
const script=readFileSync("scripts/pilot-wave1-client-privilege-regression.py","utf8");
const workflow=readFileSync(".github/workflows/pilot-synthetic-db-storage-recovery.yml","utf8");
const tables=["profiles","listings","listing_photos","schools","school_codes",
  "school_access_codes","user_roles","notifications"];
test("wave 1 migration is strictly non-RLS privileges on eight preapproved tables",()=>{
  assert.match(migration,/REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN/);
  assert.match(migration,/FROM anon, authenticated/);
  for(const t of tables)assert.ok(migration.includes("public."+t),t);
  assert.doesNotMatch(migration,/\b(?:DROP|TRUNCATE TABLE|DELETE FROM|INSERT INTO|ALTER TABLE|CREATE TABLE)\b/i);
  assert.doesNotMatch(migration,/REVOKE\s+(?:SELECT|INSERT|UPDATE|DELETE)\b/i);
});
test("wave 1 regression refuses remote databases and checks idempotence",()=>{
  assert.match(script,/Refusing non-disposable PostgreSQL/);
  assert.match(script,/Refusing to overwrite existing QA database/);
  assert.match(script,/drop database if exists/);
  assert.match(script,/for p in denied\+ordinary/);
  assert.match(script,/execute_file\(migration\) # repeat should not fail/);
  assert.match(script,/grant truncate on public\.profiles/);
  assert.match(workflow,/pilot-wave1-client-privilege-regression\.py/);
});
test("synthetic runner is parseable Python",()=>{
 const p=spawnSync("python3",["-c","import ast,pathlib;ast.parse(pathlib.Path('scripts/pilot-wave1-client-privilege-regression.py').read_text())"],{encoding:"utf8",timeout:5000});
 assert.equal(p.status,0,p.stderr);
});
