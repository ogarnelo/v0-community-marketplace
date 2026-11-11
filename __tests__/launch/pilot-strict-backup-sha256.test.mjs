import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,rmSync,writeFileSync,mkdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createHash} from "node:crypto";

const checker="scripts/pilot-verify-backup-sha256.py";
const sha=data=>createHash("sha256").update(data).digest("hex");
function run({acl=false, lines=null, extras=[],altered=false, symlink=false}={}){
 const dir=mkdtempSync(join(tmpdir(),"wetudy-strict-sha256-"));
 try{
  const backup=join(dir,"backup");
  mkdirSync(backup);
  const dump=Buffer.from("synthetic encrypted dump bytes");
  writeFileSync(join(backup,"wetudy.dump.enc"),altered?Buffer.from("tampered"):dump);
  const aclBytes=Buffer.from("synthetic encrypted ACL bytes");
  if(acl)writeFileSync(join(backup,"wetudy-acl-snapshot.json.enc"),aclBytes);
  const defaultLines=[sha(dump)+"  backup/wetudy.dump.enc"];
  if(acl)defaultLines.push(sha(aclBytes)+"  backup/wetudy-acl-snapshot.json.enc");
  writeFileSync(join(backup,"SHA256SUMS.txt"),(lines??defaultLines).join("\n")+"\n");
  for(const [name,data] of extras)writeFileSync(join(backup,name),data);
  return spawnSync("python3",[checker,backup],{encoding:"utf8",timeout:5000});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test("accepts legacy one-entry and encrypted-ACL two-entry manifest",()=>{
 assert.equal(run().status,0);
 assert.equal(run({acl:true}).status,0);
});
test("rejects tampering, missing ACL checksum and unexpected extracted file",()=>{
 for(const args of [
   {altered:true},
   {acl:true,lines:[sha("synthetic encrypted dump bytes")+"  backup/wetudy.dump.enc"]},
   {extras:[["unlisted.enc","x"]]},
 ]) {
  const result=run(args);
  assert.equal(result.status,2,result.stderr);
  assert.match(result.stderr,/BLOCKED/);
 }
});
test("rejects duplicate, nonwhitelisted, absolute and traversal manifest records",()=>{
 const one=sha("synthetic encrypted dump bytes")+"  backup/wetudy.dump.enc";
 for(const lines of [
   [one,one],
   [one,sha("a")+"  ../../secrets"],
   [one,sha("a")+"  /tmp/private"],
   [one,sha("a")+"  backup/other.enc"],
   [one.replace("  backup/"," *backup/")],
   [one.toUpperCase()],
   [],
 ]) {
  const result=run({lines});
  assert.equal(result.status,2,lines.join("|"));
 }
});
test("restore verifies strict SHA before running openssl",()=>{
 const sh=readFileSync("scripts/pilot-db-restore-drill.sh","utf8");
 assert.match(sh,/pilot-verify-backup-sha256\.py/);
 assert.ok(sh.indexOf("pilot-safe-encrypted-backup-zip.py") <
    sh.indexOf("pilot-verify-backup-sha256.py"));
 assert.ok(sh.indexOf("pilot-verify-backup-sha256.py") <
    sh.indexOf("openssl enc -d"));
 const script=readFileSync(checker,"utf8");
 assert.doesNotMatch(script,/subprocess|requests|urllib\.request|psql|pg_restore/);
 const workflow=readFileSync(".github/workflows/pilot-combined-encrypted-recovery.yml","utf8");
 assert.match(workflow,/pilot-verify-backup-sha256\.py/);
});
