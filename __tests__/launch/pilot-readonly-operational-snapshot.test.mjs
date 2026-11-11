import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync("scripts/pilot-readonly-operational-snapshot.sql","utf8");
test("pilot operational snapshot is read-only and returns aggregate counters only",()=>{
 assert.match(sql,/BEGIN TRANSACTION READ ONLY;/);
 assert.match(sql,/COMMIT;/);
 for(const column of [
  "demo_listings","outbox_rows","active_test_schools","active_non_test_schools",
  "active_directory_links","school_directory_rows","total_rls_policies",
  "sensitive_grant_cells"
 ])assert.match(sql,new RegExp("\\b"+column+"\\b"));
 assert.doesNotMatch(sql,/^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO|COPY)\b/gmi);
 assert.doesNotMatch(sql,/auth\.users|profiles\.email|email_address|recipient_email|storage\.objects|service_role/);
 assert.match(sql,/count\(\*\)/);
});
test("pilot school activation count excludes the known test-only school",()=>{
 assert.match(sql,/is_active IS TRUE AND is_test IS TRUE/);
 assert.match(sql,/is_active IS TRUE AND is_test IS DISTINCT FROM TRUE/);
 assert.match(sql,/is_listed OR seo_indexable OR linked_school_id IS NOT NULL/);
});
test("operational ACL check covers 11 public tables, two client roles, four permissions",()=>{
 for(const table of ["saved_searches","saved_search_matches",
  "user_marketplace_preferences","profiles","listings","listing_photos",
  "schools","school_codes","school_access_codes","user_roles","notifications"])
   assert.ok(sql.includes("'"+table+"'"),table);
 for(const p of ["TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"])
   assert.ok(sql.includes("'"+p+"'"),p);
 assert.match(sql,/has_table_privilege/);
 assert.match(sql,/CROSS JOIN checked_roles CROSS JOIN checked_permissions/);
});
