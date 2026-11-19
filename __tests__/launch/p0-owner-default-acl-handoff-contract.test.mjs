import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("scripts/p0_supabase_admin_owner_only_default_acl_handoff.sql","utf8");
const sample=readFileSync("scripts/p0_pg17_supabase_admin_acl_synthetic.sql","utf8");
const workflow=readFileSync(".github/workflows/p0-owner-default-acl-synthetic.yml","utf8");
test("SQL requires genuine supabase_admin and rejects drift beyond 16 current grants",()=>{
 assert.match(sql,/current_user <> 'supabase_admin'/);
 assert.match(sql,/v_grants <> 16/);
 assert.match(sql,/ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public/);
 assert.match(sql,/REVOKE ALL ON TABLES FROM anon,authenticated/);
 assert.match(sql,/EXCEPT/);
 assert.match(sql,/WETUDY_ORDINARY_OWNER_OR_SERVICE_GRANTS_CHANGED/);
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;/);
 assert.doesNotMatch(sql,/GRANT supabase_admin TO postgres|ALTER ROLE.*SUPERUSER|SET ROLE supabase_admin|DROP TABLE|TRUNCATE /i);
});
test("PG17 smoke is explicitly ephemeral and checks future-table grantees",()=>{
 assert.match(sample,/wetudy_synthetic_acl_probe/);
 assert.match(sample,/v_count <> 16/);
 assert.match(sample,/v_clients <> 0 OR v_owners <> 16/);
 assert.match(workflow,/postgres:17/);
 assert.match(workflow,/wetudy_acl_disposable/);
 assert.doesNotMatch(workflow,/SUPABASE_URL|SUPABASE_SERVICE|project_id|jpsljmakoscqevssimtk/);
});
