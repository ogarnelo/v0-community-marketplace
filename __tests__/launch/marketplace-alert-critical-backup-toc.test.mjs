import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const critical=[
 "profiles","account_students","user_roles","listings","listing_photos","listing_offers",
 "conversations","messages","notifications","agreements","payment_intents","payment_events",
 "marketplace_postal_centroids","marketplace_alert_outbox","saved_searches",
 "saved_search_matches","transactional_email_deliveries",
 "transactional_email_recipient_health",
];
const inventorySource=readFileSync("scripts/pilot-dr-scope-audit.py","utf8");
const names=inventorySource.match(/PUBLIC_TABLES = set\("""([\s\S]*?)"""\.split\(\)\)/);
assert.ok(names,"verified public inventory missing");
const allPublic=names[1].trim().split(/\s+/);
assert.equal(allPublic.length,79);
function fakeToc(missing=[], includeManaged=false){
  let id=100;
  const rows=[];
  for(const table of allPublic){
    for(const kind of ["TABLE","TABLE DATA"]){
      if(!missing.includes(table+":"+kind))
        rows.push(`${id++}; 1259 9876 ${kind} public ${table} wetudy_ci`);
    }
  }
  if(includeManaged){
    for(const [schema,name] of [["auth","users"],["auth","identities"],["storage","objects"]])
      for(const kind of ["TABLE","TABLE DATA"])
        rows.push(`${id++}; 1259 9876 ${kind} ${schema} ${name} wetudy_ci`);
  }
  return rows.join("\n")+"\n";
}
function verify(toc){
  const dir=mkdtempSync(join(tmpdir(),"wetudy-toc-"));
  const path=join(dir,"synthetic.toc");
  try{
    writeFileSync(path,toc);
    const r=spawnSync("python3",["scripts/pilot-db-backup-critical-toc.py",path],{
      encoding:"utf8",timeout:5000,env:{PATH:process.env.PATH}
    });
    assert.equal(r.error,undefined);
    return {status:r.status,report:JSON.parse(r.stdout.split("\n")[0]),stderr:r.stderr};
  }finally{rmSync(dir,{recursive:true,force:true});}
}
test("critical public tables need both DDL and DATA TOC entries",()=>{
  const r=verify(fakeToc());
  assert.equal(r.status,0);
  assert.equal(r.report.critical_public_toc_ready,true);
  assert.equal(r.report.public_toc_sections_checked,36);
  assert.equal(r.report.all_public_toc_sections_checked,158);
  assert.equal(r.report.all_public_toc_ready,true);
  assert.equal(r.report.full_disaster_recovery_certified,false);
});
test("missing postcode centroids DATA and outbox DDL fail the gate",()=>{
  const r=verify(fakeToc(["marketplace_postal_centroids:TABLE DATA","marketplace_alert_outbox:TABLE"]));
  assert.equal(r.status,2);
  assert.deepEqual(r.report.missing_critical_public_toc.nearby_search_and_alerts,
    ["marketplace_postal_centroids:table_data","marketplace_alert_outbox:table"]);
  assert.match(r.stderr,/BLOCKED/);
  assert.equal(r.report.all_public_toc_ready,false);
});
test("missing conversations or transactions cannot be mistaken for complete backup",()=>{
  const r=verify(fakeToc(["messages:TABLE DATA","payment_events:TABLE DATA"]));
  assert.equal(r.status,2);
  assert.ok(r.report.missing_critical_public_toc.communications);
  assert.ok(r.report.missing_critical_public_toc.transactions);
});
test("managed auth and storage are reported, never declared fully restored",()=>{
  const r=verify(fakeToc([],true));
  assert.equal(r.status,0);
  assert.equal(r.report.managed_auth_storage_toc_present.auth.users,true);
  assert.equal(r.report.managed_auth_storage_toc_present.storage.objects,true);
  assert.equal(r.report.full_disaster_recovery_certified,false);
});
test("restore workflow remains local-only and requires protected backup artifact",()=>{
  const restore=readFileSync("scripts/pilot-db-restore-drill.sh","utf8");
  const workflow=readFileSync(".github/workflows/pilot-combined-encrypted-recovery.yml","utf8");
  assert.match(restore,/pilot-local-restore-target-check\.py/);
  assert.match(restore,/wetudy-restore\.toc/);
  assert.match(restore,/pilot-db-backup-critical-toc\.py/);
  assert.match(workflow,/pilot-db-backup-critical-toc\.py/);
  assert.doesNotMatch(restore,/BACKUP_DATABASE_URL|pg_restore --clean/);
});

test("a non-critical public table missing DATA fails the all-table archive check",()=>{
  const result=verify(fakeToc(["referrals:TABLE DATA"]));
  assert.equal(result.status,2);
  assert.equal(result.report.critical_public_toc_ready,true);
  assert.equal(result.report.all_public_toc_ready,false);
  assert.ok(result.report.missing_public_toc_sections.includes("referrals:table_data"));
});
