import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync("scripts/pilot-readonly-deny-only-rls-audit.sql","utf8");
const protectedTables=[
 "marketplace_alert_outbox","marketplace_postal_centroids",
 "school_directory","school_impact_report_deliveries",
 "school_impact_report_subscriptions","super_admin_report_subscriptions"
];
test("six deny-only tables require RLS, no policies, and no effective client DML grants",()=>{
 for(const name of protectedTables)assert.ok(sql.includes("'"+name+"'"),name);
 for(const permission of ["SELECT","INSERT","UPDATE","DELETE"])
   assert.ok(sql.includes("'"+permission+"'"),permission);
 assert.match(sql,/has_table_privilege/);
 assert.match(sql,/relrowsecurity/);
 assert.match(sql,/pg_policies/);
 for(const result of ["checked_cells","missing_table_cells","rls_disabled_cells",
  "unexpected_policy_cells","effective_client_grant_cells","deny_only_guard_pass"])
   assert.ok(sql.includes(result),result);
});
test("deny-only audit is read-only, aggregate and does not expose family data",()=>{
 assert.match(sql,/BEGIN TRANSACTION READ ONLY;/);
 assert.match(sql,/COMMIT;/);
 assert.doesNotMatch(sql,/^\s*(?:UPDATE|DELETE|INSERT|GRANT|REVOKE|CREATE|ALTER|DROP|TRUNCATE|CALL|COPY)\b/gmi);
 assert.doesNotMatch(sql,/auth\.users|profiles\.email|service_role|BACKUP_DATABASE_URL/);
 assert.match(sql,/bool_and\(table_exists AND rls_enabled/);
});
