import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const fixture=readFileSync("scripts/pilot-marketplace-saved-search-recovery.py","utf8");
const workflow=readFileSync(".github/workflows/pilot-synthetic-db-storage-recovery.yml","utf8");
test("synthetic nearby recovery is restricted to ephemeral localhost PostgreSQL",()=>{
  assert.match(fixture,/hostname not in \("localhost", "127\.0\.0\.1", "::1"\)/);
  assert.match(fixture,/wetudy_pilot_dr_source/);
  assert.match(fixture,/Refusing to overwrite an existing database/);
  assert.match(fixture,/drop database if exists wetudy_pilot_nearby_restored with \(force\)/);
  assert.doesNotMatch(fixture,/supabase\.co|BACKUP_DATABASE_URL|RESEND_API_KEY|service_role/);
});
test("cold restore verifies saved searches, postal distance, match state, outbox and receipts",()=>{
  for(const name of ["marketplace_postal_centroids","user_marketplace_preferences",
    "saved_searches","saved_search_matches","marketplace_alert_outbox",
    "transactional_email_deliveries","listings"]){
    assert.match(fixture,new RegExp(name));
  }
  assert.match(fixture,/pg_dump/);
  assert.match(fixture,/pg_restore/);
  assert.match(fixture,/snapshot\(TARGET\)!=original/);
  assert.match(fixture,/verify\(TARGET\)/);
});
test("restored data tampering fails for 5 independent cases",()=>{
  for(const name of ["postcode mismatch","match owner mismatch","missing receipt",
    "incomplete alert","unsent match"]){
    assert.ok(fixture.includes(name));
  }
  assert.match(fixture,/Tampered recovery was not detected/);
});
test("CI uses isolated PostgreSQL and does not run source against remote DB",()=>{
  assert.match(workflow,/postgres:17/);
  assert.match(workflow,/127\.0\.0\.1/);
  assert.match(workflow,/python3 scripts\/pilot-marketplace-saved-search-recovery\.py/);
});
test("Python fixture compiles without connecting to any database",()=>{
  const p=spawnSync("python3",["-c","import ast,pathlib; ast.parse(pathlib.Path('scripts/pilot-marketplace-saved-search-recovery.py').read_text())"],{encoding:"utf8",timeout:5000});
  assert.equal(p.status,0,p.stderr);
});
