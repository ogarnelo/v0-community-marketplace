import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const now="2026-11-10T20:00:00Z";
const backup={id:111,name:"wetudy-encrypted-postgres-backup",expired:false,
  created_at:"2026-11-10T10:00:00Z",expires_at:"2026-11-17T10:00:00Z"};
const restore={name:"Wetudy combined encrypted backup recovery check",conclusion:"success",
  created_at:"2026-11-10T11:00:00Z"};
function verify(artifactItems=[backup],runs=[restore]){
  const dir=mkdtempSync(join(tmpdir(),"wetudy-backup-metadata-"));
  try{
    const a=join(dir,"artifacts.json"),r=join(dir,"runs.json");
    writeFileSync(a,JSON.stringify({artifacts:artifactItems}));
    writeFileSync(r,JSON.stringify({workflow_runs:runs}));
    const child=spawnSync("python3",[
      "scripts/pilot-alert-encrypted-backup-freshness.py",
      "--artifacts-json",a,"--runs-json",r,"--now",now],{
        encoding:"utf8",timeout:5000,env:{PATH:process.env.PATH},
      });
    assert.equal(child.error,undefined);
    return {exit:child.status,result:JSON.parse(child.stdout)};
  }finally{rmSync(dir,{recursive:true,force:true});}
}
test("recent encrypted artifact + later successful partial restore passes readiness metadata",()=>{
  const r=verify();
  assert.equal(r.exit,0);
  assert.equal(r.result.ready,true);
  assert.equal(r.result.artifact_id,111);
  assert.equal(r.result.age_hours,10);
});
test("old artifact cannot authorize a production migration",()=>{
  const r=verify([{...backup,created_at:"2026-11-08T10:00:00Z"}],
    [{...restore,created_at:"2026-11-09T11:00:00Z"}]);
  assert.equal(r.exit,1);assert.equal(r.result.reason,"backup_too_old");
});
test("missing or expired artifact fails closed",()=>{
  assert.equal(verify([]).result.reason,"missing_unexpired_backup");
  assert.equal(verify([{...backup,expired:true}]).exit,1);
});
test("archive close to retention expiry fails closed",()=>{
  const r=verify([{...backup,expires_at:"2026-11-11T10:00:00Z"}]);
  assert.equal(r.exit,1);assert.equal(r.result.reason,"backup_expiring");
});
test("failed restore, old restore, or wrong workflow cannot certify backup",()=>{
  for(const run of [
    {...restore,conclusion:"failure"},
    {...restore,created_at:"2026-11-09T11:00:00Z"},
    {...restore,name:"Synthetic restore only"},
  ]){
    const r=verify([backup],[run]);
    assert.equal(r.exit,1);assert.equal(r.result.reason,"no_successful_partial_restore_after_backup");
  }
});
test("does not download archives, restore DB, access secrets or touch production",()=>{
  const code=readFileSync("scripts/pilot-alert-encrypted-backup-freshness.py","utf8");
  assert.doesNotMatch(code,/import requests|urllib\.request|subprocess|pg_restore|pg_dump|psql|SUPABASE_SECRET|BACKUP_ENCRYPTION_PASSWORD/);
  assert.match(code,/only for deterministic tests/);
});

test("GitHub metadata gate is read-only, scoped to repo, and never touches backup bytes",()=>{
  const workflow=readFileSync(".github/workflows/pilot-alert-backup-readiness.yml","utf8");
  assert.match(workflow,/permissions:\s*\n\s*contents: read\s*\n\s*actions: read/);
  assert.match(workflow,/GITHUB_REPOSITORY.*ogarnelo\/v0-community-marketplace/);
  assert.match(workflow,/gh api "repos\/\$GITHUB_REPOSITORY\/actions\/artifacts\?name=wetudy-encrypted-postgres-backup/);
  assert.match(workflow,/gh api "repos\/\$GITHUB_REPOSITORY\/actions\/workflows\/pilot-combined-encrypted-recovery\.yml\/runs/);
  assert.match(workflow,/scripts\/pilot-alert-encrypted-backup-freshness\.py/);
  assert.doesNotMatch(workflow,/pg_dump|pg_restore|pg_read_file|supabase db|apply_migration|BACKUP_ENCRYPTION_PASSWORD|RESEND_API_KEY/);
  assert.doesNotMatch(workflow,/artifact\.zip|download-artifact|curl/);
});
