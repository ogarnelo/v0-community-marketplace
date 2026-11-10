import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function runAudit(extra=[]){
  const r=spawnSync("python3",["scripts/pilot-dr-scope-audit.py",...extra],
    {encoding:"utf8",timeout:5000,env:{PATH:process.env.PATH}});
  assert.equal(r.error,undefined);
  return r;
}
test("recovery scope inventory includes all 79 current public tables, not just six synthetic fixtures",()=>{
  const r=runAudit();
  assert.equal(r.status,0);
  const x=JSON.parse(r.stdout);
  assert.equal(x.inventory_as_of,"2026-11-10");
  assert.equal(x.total_public_tables,79);
  assert.equal(x.tested_local_public_tables,6);
  assert.equal(x.untested_public_tables,73);
  assert.equal(x.tested_public_table_coverage_pct,7.6);
  assert.equal(x.ready_for_full_production_restore,false);
});
test("postcode distance and saved-search email recovery gaps are separately named",()=>{
  const x=JSON.parse(runAudit().stdout);
  const missing=x.missing_by_critical_workflow.nearby_search_and_alerts;
  for(const name of ["marketplace_postal_centroids","marketplace_alert_outbox",
    "saved_searches","saved_search_matches","transactional_email_deliveries",
    "user_marketplace_preferences"]){
    assert.ok(missing.includes(name),name+" should be marked as untested");
  }
});
test("production-restore gate must never accept a partial six-table restore",()=>{
  const r=runAudit(["--require-full-coverage"]);
  assert.equal(r.status,2);
  assert.match(r.stderr,/BLOCKED/);
  const data=JSON.parse(r.stdout);
  assert.equal(data.ready_for_full_production_restore,false);
});
test("audit cannot access data rows, API secrets, or production endpoints",()=>{
  const code=readFileSync("scripts/pilot-dr-scope-audit.py","utf8");
  assert.doesNotMatch(code,/requests\.get|urllib\.request|create_client|SUPABASE_SERVICE_ROLE_KEY|BACKUP_DATABASE_URL|psql|execute_sql/);
  assert.match(code,/ready_for_full_production_restore": False/);
});
