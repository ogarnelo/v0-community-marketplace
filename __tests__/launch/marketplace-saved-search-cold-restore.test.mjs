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

test("synthetic restored RLS keeps two family searches and matches isolated",()=>{
  assert.match(fixture,/create role qa_near_family nologin/);
  assert.match(fixture,/set local role qa_near_family/);
  assert.match(fixture,/request\.jwt\.claim\.sub/);
  for(const name of ["saved_searches","saved_search_matches","user_marketplace_preferences"]){
    assert.match(fixture,new RegExp("alter table qa_near_market\\."+name+" enable row level security"));
  }
  assert.match(fixture,/verify_restored_family_isolation\(SOURCE\)/);
  assert.match(fixture,/verify_restored_family_isolation\(TARGET\)/);
  assert.match(fixture,/B:"1:1:1"/);
  assert.match(fixture,/A:"0:0:1"/);
});
test("dump and restore retain synthetic SQL ACLs and RLS policies",()=>{
  assert.doesNotMatch(fixture,/pg_dump[^\n]*--no-acl/);
  assert.match(fixture,/grant select on qa_near_market\.user_marketplace_preferences/);
  assert.match(fixture,/has_schema_privilege\('qa_near_family'/);
  assert.match(fixture,/grant usage on schema qa_near_market to qa_near_family/);
  assert.match(fixture,/has_table_privilege\('qa_near_family'/);
});

test("restored synthetic family writes honor owner checks in both source and target",()=>{
  assert.match(fixture,/verify_restored_family_write_isolation\(SOURCE\)/);
  assert.match(fixture,/verify_restored_family_write_isolation\(TARGET\)/);
  assert.match(fixture,/for update to qa_near_family/);
  assert.match(fixture,/for insert to qa_near_family/);
  assert.match(fixture,/with check\(user_id=nullif\(current_setting/);
  for(const text of [
    "Cross-family update was not blocked",
    "Cross-family postcode update was not blocked",
    "RLS failed to reject another family's saved-search INSERT",
    "Family can mutate protected alert/delivery state",
    "Synthetic RLS write tests changed restored rows",
  ]) assert.ok(fixture.includes(text));
});
test("no privileged client write path is introduced for matching or alert receipts",()=>{
  assert.doesNotMatch(fixture,/grant (insert|update|delete).*saved_search_matches to qa_near_family/i);
  assert.doesNotMatch(fixture,/grant (insert|update|delete).*marketplace_alert_outbox to qa_near_family/i);
  assert.match(fixture,/grant update\(radius_km\)/);
  assert.match(fixture,/grant update\(postal_code\)/);
});
