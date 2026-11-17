import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("scripts/p0_supabase_admin_default_acl_executor_preflight_read_only.sql","utf8");
const candidate=readFileSync("scripts/p0_public_default_acl_supabase_admin_privileged_only_review.sql","utf8");
test("executor diagnostic runs READ ONLY without changing roles or default privileges",()=>{
 const plain=sql.replace(/--[^\n]*/g,"");
 assert.match(plain,/BEGIN READ ONLY;/);
 assert.match(plain,/COMMIT;/);
 assert.match(plain,/pg_has_role\(current_user, 'supabase_admin', 'MEMBER'\)/);
 assert.match(plain,/aclexplode\(d\.defaclacl\)/);
 assert.match(plain,/n\.nspname='public'/);
 assert.doesNotMatch(plain,/^\s*(?:ALTER|REVOKE|GRANT|SET\s+ROLE|INSERT|UPDATE|DELETE|DROP|CREATE|DO|CALL)\b/im);
});
test("existing candidate requires legitimate membership and does not grant itself membership",()=>{
 assert.match(candidate,/pg_has_role\(current_user,'supabase_admin','MEMBER'\)/);
 assert.match(candidate,/ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public/);
 assert.doesNotMatch(candidate,/GRANT\s+supabase_admin\s+TO|ALTER ROLE|SET ROLE/);
 assert.match(candidate,/NO_GO_DEFAULT_ADMIN/);
});
test("read only preflight preserves existing application-grant probes",()=>{
 assert.match(sql,/has_table_privilege\('anon','public\.listings','SELECT'\)/);
 assert.match(sql,/has_table_privilege\('authenticated','public\.listings','UPDATE'\)/);
 assert.match(sql,/has_table_privilege\('service_role','public\.listings','SELECT'\)/);
});
