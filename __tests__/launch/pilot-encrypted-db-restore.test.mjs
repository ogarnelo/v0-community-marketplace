import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {spawnSync} from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const workflow = read(".github/workflows/pilot-encrypted-db-restore-drill.yml");
const script = read("scripts/pilot-db-restore-drill.sh");

test("restore drill uses ephemeral local PostgreSQL and an encrypted existing artifact", () => {
  assert.match(workflow, /image: postgres:17/);
  assert.match(workflow, /LOCAL_RESTORE_URL: postgresql:\/\/wetudy_restore:[^@]+@127\.0\.0\.1:5432\/wetudy_restore/);
  assert.match(workflow, /WETUDY_BACKUP_ENCRYPTION_PASSWORD/);
  assert.match(script, /pilot-local-restore-target-check\.py/);
  assert.match(script, /wetudy-encrypted-postgres-backup/);
  assert.match(script, /sha256sum -c backup\/SHA256SUMS\.txt/);
  assert.match(script, /openssl enc -d -aes-256-cbc -pbkdf2/);
  assert.doesNotMatch(script, /WETUDY_BACKUP_DATABASE_URL|CREATE DATABASE.+supabase/);
});

test("read-only source backup restores only the publicly sourced directory", () => {
  assert.match(script, /--table=school_directory --section=pre-data/);
  assert.match(script, /--table=school_directory --data-only/);
  assert.match(script, /count.*-ge 30000/);
  assert.match(script, /official_code='04602365'/);
  assert.match(script, /is_listed or seo_indexable or linked_school_id is not null/);
  assert.match(script, /trap 'rm -rf "\$workdir"' EXIT/);
  assert.doesNotMatch(script, /--clean|--create|pg_restore.*BACKUP_DATABASE_URL/);
});

test("workflow is one-time on initial main merge and can be run manually later", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /pilot-encrypted-db-restore-drill\.yml/);
  assert.doesNotMatch(workflow, /schedule:/);
});

test("preflight refuses non-dedicated local targets before touching archives",()=>{
  const valid="postgresql://wetudy_restore:local_only_password@127.0.0.1:5432/wetudy_restore";
  const run=url=>spawnSync("python3",["scripts/pilot-local-restore-target-check.py"],{
    encoding:"utf8",timeout:5000,env:{PATH:process.env.PATH,LOCAL_RESTORE_URL:url}
  });
  assert.equal(run(valid).status,0);
  for(const url of [
    valid.replace("/wetudy_restore","/postgres"),
    valid.replace("127.0.0.1","localhost"),
    valid.replace(":5432",":6432"),
    valid.replace("wetudy_restore:","postgres:"),
    valid+"?options=-csearch_path%3Dpublic",
    "postgresql://wetudy_restore:pass@remote.example:5432/wetudy_restore",
    "",
  ]){
    const result=run(url);
    assert.equal(result.status,2,url);
    assert.match(result.stderr,/BLOCKED/);
  }
});
