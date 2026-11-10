import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const now="2026-11-10T20:00:00Z";
const backup={id:111,name:"wetudy-encrypted-postgres-backup",expired:false,
  created_at:"2026-11-10T10:00:00Z",expires_at:"2026-11-17T10:00:00Z",
  workflow_run:{id:222,head_branch:"main"}};
const restore={name:"Wetudy combined encrypted backup recovery check",conclusion:"success",
  path:".github/workflows/pilot-combined-encrypted-recovery.yml",head_branch:"main",
  created_at:"2026-11-10T11:00:00Z"};
const sourceRun={id:222,name:"Wetudy encrypted database backup",conclusion:"success",
  path:".github/workflows/wetudy-encrypted-db-backup.yml",head_branch:"main",
  created_at:"2026-11-10T09:00:00Z"};
function verify(artifactItems=[backup],runs=[restore],sourceRuns=[sourceRun]){
  const dir=mkdtempSync(join(tmpdir(),"wetudy-backup-metadata-"));
  try{
    const a=join(dir,"artifacts.json"),r=join(dir,"runs.json"),b=join(dir,"source-runs.json");
    writeFileSync(a,JSON.stringify({artifacts:artifactItems}));
    writeFileSync(r,JSON.stringify({workflow_runs:runs}));
    writeFileSync(b,JSON.stringify({workflow_runs:sourceRuns}));
    const child=spawnSync("python3",[
      "scripts/pilot-alert-encrypted-backup-freshness.py",
      "--artifacts-json",a,"--runs-json",r,"--backup-runs-json",b,"--now",now],{
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
  assert.equal(verify([]).result.reason,"missing_verified_backup_provenance");
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
  assert.match(workflow,/wetudy-encrypted-db-backup\.yml\/runs/);
  assert.match(workflow,/--backup-runs-json/);
  assert.doesNotMatch(workflow,/pg_dump|pg_restore|pg_read_file|supabase db|apply_migration|BACKUP_ENCRYPTION_PASSWORD|RESEND_API_KEY/);
  assert.doesNotMatch(workflow,/artifact\.zip|download-artifact|curl/);
});

test("only an artifact linked to successful official backup run on main is trusted",()=>{
  for(const run of [
    {...sourceRun,conclusion:"failure"},
    {...sourceRun,head_branch:"other"},
    {...sourceRun,path:".github/workflows/unknown.yml"},
    {...sourceRun,id:444},
    {...sourceRun,created_at:"2026-11-10T12:00:00Z"},
  ]){
    const r=verify([backup],[restore],[run]);
    assert.equal(r.exit,1);
    assert.equal(r.result.reason,"missing_verified_backup_provenance");
  }
  assert.equal(verify([{...backup,workflow_run:{id:222,head_branch:"other"}}]).exit,1);
});
test("restore results from a fork/branch or a wrong workflow cannot certify readiness",()=>{
  for(const badRestore of [
    {...restore,head_branch:"test"},
    {...restore,path:".github/workflows/other-restore.yml"},
    {...restore,created_at:"2026-11-09T11:00:00Z"},
  ]){
    const result=verify([backup],[badRestore],[sourceRun]);
    assert.equal(result.exit,1);
    assert.equal(result.result.reason,"no_successful_partial_restore_after_backup");
  }
});
