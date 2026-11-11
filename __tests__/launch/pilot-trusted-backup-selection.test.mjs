import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";

const stamp="2026-11-11T14:00:00Z";
const goodRun={id:90,name:"Wetudy encrypted database backup",
 path:".github/workflows/wetudy-encrypted-db-backup.yml",
 head_branch:"main",event:"workflow_dispatch",conclusion:"success",
 created_at:"2026-11-11T10:00:00Z"};
const good={id:111,name:"wetudy-encrypted-postgres-backup",expired:false,
 created_at:"2026-11-11T10:05:00Z",expires_at:"2026-11-18T10:05:00Z",
 workflow_run:{id:90,head_branch:"main"}};
function run(artifacts=[good],runs=[goodRun]){
 const dir=mkdtempSync(join(tmpdir(),"wetudy-backup-provenance-"));
 try{
   const a=join(dir,"a.json"),r=join(dir,"r.json");
   writeFileSync(a,JSON.stringify({artifacts}));
   writeFileSync(r,JSON.stringify({workflow_runs:runs}));
   return spawnSync("python3",["scripts/pilot-select-trusted-backup-artifact.py",a,r],
     {encoding:"utf8",timeout:5000});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test("selector accepts only unexpired verified official main backup",()=>{
 const ok=run();
 assert.equal(ok.status,0,ok.stderr);
 assert.equal(ok.stdout.trim(),"111");
});
test("latest untrusted archive cannot displace an older valid official one",()=>{
 const wrong={...good,id:222,created_at:"2026-11-11T12:05:00Z",
   workflow_run:{id:91,head_branch:"main"}};
 assert.equal(run([good,wrong],[goodRun]).stdout.trim(),"111");
});
test("untrusted run, branch, event, failure, missing evidence and expiration fail closed",()=>{
 const badRuns=[
  {...goodRun,conclusion:"failure"},
  {...goodRun,head_branch:"feature"},
  {...goodRun,event:"push"},
  {...goodRun,path:".github/workflows/untrusted.yml"},
  {...goodRun,name:"Different workflow"},
  {...goodRun,id:91}
 ];
 for(const bad of badRuns){
   const result=run([good],[bad]);
   assert.equal(result.status,2);
   assert.match(result.stderr,/BLOCKED/);
 }
 for(const bad of [
  {...good,expired:true},
  {...good,expires_at:"2026-11-11T00:00:00Z"},
  {...good,workflow_run:{id:90,head_branch:"feature"}},
  {...good,created_at:"2026-11-10T10:05:00Z"}
 ])assert.equal(run([bad]).status,2);
});
test("restore uses provenance selector before downloading or decrypting",()=>{
 const sh=readFileSync("scripts/pilot-db-restore-drill.sh","utf8");
 assert.match(sh,/pilot-select-trusted-backup-artifact\\.py/);
 assert.match(sh,/wetudy-encrypted-db-backup\\.yml\\/runs/);
 assert.ok(sh.indexOf("pilot-select-trusted-backup-artifact.py") <
   sh.indexOf("actions/artifacts/$artifact_id/zip"));
 const workflow=readFileSync(".github/workflows/pilot-combined-encrypted-recovery.yml","utf8");
 assert.match(workflow,/scripts\\/pilot-select-trusted-backup-artifact\\.py/);
 const selector=readFileSync("scripts/pilot-select-trusted-backup-artifact.py","utf8");
 assert.doesNotMatch(selector,/pg_dump|pg_restore|psql|requests|urllib\\.request|subprocess/);
});
