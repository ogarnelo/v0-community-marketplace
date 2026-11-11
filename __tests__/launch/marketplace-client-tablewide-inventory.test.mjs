import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const inventory=readFileSync("scripts/pilot-client-tablewide-privileges-inventory.sql","utf8");
test("privilege inventory only queries metadata inside READ ONLY transaction",()=>{
  assert.match(inventory,/BEGIN TRANSACTION READ ONLY;/);
  assert.match(inventory,/COMMIT;/);
  const body=inventory.replace(/^\s*--.*$/gm,"");
  assert.doesNotMatch(body,/^\s*(?:ALTER|GRANT|REVOKE|TRUNCATE|INSERT|UPDATE|DELETE|DROP|CREATE)\b/gmi);
  assert.match(body,/pg_class/);
  assert.match(body,/pg_default_acl/);
  assert.match(body,/aclexplode/);
});
test("reports both clients and all four unrestricted table privileges",()=>{
  for(const perm of ["TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"])
    assert.ok(inventory.includes("'"+perm+"'"));
  assert.match(inventory,/\('anon'\),\('authenticated'\)/);
  assert.match(inventory,/public_tables_checked/);
  assert.match(inventory,/any_tablewide_grants/);
  assert.match(inventory,/public_table_name/);
});
test("does not read families' rows, run service actions or emit secrets",()=>{
  const body=inventory.replace(/^\s*--.*$/gm,"");
  assert.doesNotMatch(body,/\bFROM\s+(?:public\.|auth\.)(?:profiles|messages|listings|users|conversations|schools|saved_searches)/i);
  assert.doesNotMatch(body,/pg_get_userbyid|pg_read_file|password|jwt_secret|RESEND_API_KEY|pg_dump|pg_restore/);
});
