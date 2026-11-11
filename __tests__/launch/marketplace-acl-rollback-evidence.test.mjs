import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("scripts/pilot-acl-rollback-evidence-readonly.sql","utf8");
test("ACL evidence is a metadata-only and non-mutating transaction",()=>{
  assert.match(sql,/BEGIN TRANSACTION READ ONLY;/i);
  assert.match(sql,/COMMIT;/i);
  const s=sql.replace(/^\s*--.*$/gm,"");
  assert.doesNotMatch(s,/^\s*(?:GRANT|REVOKE|CREATE|ALTER|DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/gmi);
  assert.doesNotMatch(s,/\bFROM\s+(?:public|auth)\.(?:profiles|users|messages|listings|saved_searches)\b/i);
});
test("ACL evidence covers all 11 staged tables and both client roles",()=>{
  for(const t of ["saved_searches","saved_search_matches",
    "user_marketplace_preferences","profiles","listings","listing_photos",
    "schools","school_codes","school_access_codes","user_roles","notifications"]){
    assert.ok(sql.includes("('"+t+"')"),t);
  }
  assert.match(sql,/\('anon'\),\('authenticated'\)/);
  assert.match(sql,/all_expected_present/);
});
test("rollback evidence distinguishes effective from direct ACL and grantor",()=>{
  for(const perm of ["SELECT","INSERT","UPDATE","DELETE",
    "TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"]){
    assert.ok(sql.includes("('"+perm+"')"),perm);
  }
  assert.match(sql,/has_table_privilege/);
  assert.match(sql,/aclexplode\(c\.relacl\)/);
  assert.match(sql,/direct_grantors/);
  assert.match(sql,/direct_grant_option/);
  assert.match(sql,/direct_grant_count/);
  assert.match(sql,/effective_privilege/);
});
