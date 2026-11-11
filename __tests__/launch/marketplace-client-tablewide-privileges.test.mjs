import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const migration=readFileSync("supabase/migrations/20261111083000_marketplace_revoke_client_table_wide_privileges.sql","utf8");
const gate=readFileSync("scripts/pilot-client-tablewide-privileges-preflight.sql","utf8");
const sqltest=readFileSync("scripts/pilot-client-tablewide-privileges-regression.sql","utf8");
const runner=readFileSync("scripts/pilot-client-tablewide-privileges-regression.py","utf8");
test("security migration revokes only non-row-level privileges from anon and authenticated",()=>{
  assert.match(migration,/REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN/);
  assert.match(migration,/FROM anon, authenticated/);
  for(const t of ["saved_searches","saved_search_matches","user_marketplace_preferences"]){
    assert.ok(migration.includes("public."+t));
    assert.ok(gate.includes("'"+t+"'"));
  }
  assert.doesNotMatch(migration,/REVOKE\s+(SELECT|INSERT|UPDATE|DELETE)|DROP TABLE|DELETE FROM|TRUNCATE TABLE/i);
  assert.match(migration,/has_table_privilege/);
});
test("read-only gate rejects the four privileges that bypass or escape RLS",()=>{
  assert.match(gate,/BEGIN TRANSACTION READ ONLY/i);
  for(const p of ["TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"])
    assert.match(gate,new RegExp("'"+p+"'"));
  assert.match(gate,/RAISE EXCEPTION/);
  assert.match(gate,/COMMIT;/);
});
test("isolated SQL test demonstrates rejection, preserves DML, and checks repeatability",()=>{
  assert.match(sqltest,/has_table_privilege/);
  assert.match(sqltest,/SELECT/);
  assert.match(sqltest,/INSERT/);
  assert.match(sqltest,/UPDATE/);
  assert.match(sqltest,/DELETE/);
  assert.match(sqltest,/\\ir/);
  assert.match(runner,/migration/);
  assert.match(runner,/for p in forbidden\+allowed/);
  assert.match(runner,/Refusing nonlocal or non-disposable PostgreSQL/);
});
