import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const sql=readFileSync("scripts/pilot-client-privilege-function-entrypoints.sql","utf8");
const py=readFileSync("scripts/pilot-client-privilege-function-regression.py","utf8");
test("production function audit is entirely catalog-only and read-only",()=>{
  assert.match(sql,/BEGIN TRANSACTION READ ONLY/);
  assert.match(sql,/COMMIT;/);
  assert.match(sql,/pg_proc/);
  assert.match(sql,/has_function_privilege/);
  assert.match(sql,/prosecdef/);
  assert.doesNotMatch(sql,/^\s*(?:ALTER|GRANT|REVOKE|TRUNCATE|INSERT|UPDATE|DELETE|DROP|CREATE)\b/gmi);
});
test("rejects client-executable security definer and dangerous SQL tokens",()=>{
  assert.match(sql,/SECURITY DEFINER public functions executable by client roles/);
  assert.match(sql,/function definitions mention TRUNCATE or SET ROLE/);
  assert.match(py,/GRANT EXECUTE ON FUNCTION public\.qa_security_sensitive/);
  assert.match(py,/should_succeed=False/);
  assert.match(py,/Refusing any nonlocal\/non-disposable PostgreSQL/);
  assert.match(py,/drop database if exists/);
});
test("Python fixture parses without connecting to production",()=>{
  const c=spawnSync("python3",["-c","import ast,pathlib;ast.parse(pathlib.Path('scripts/pilot-client-privilege-function-regression.py').read_text())"],{encoding:"utf8",timeout:5000});
  assert.equal(c.status,0,c.stderr);
});
