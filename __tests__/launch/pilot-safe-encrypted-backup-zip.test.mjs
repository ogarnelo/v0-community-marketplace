import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const script="scripts/pilot-safe-encrypted-backup-zip.py";
const makeZip=`import zipfile,sys,stat
path=sys.argv[1]; mode=sys.argv[2]
with zipfile.ZipFile(path,"w") as z:
 def put(name,content=b"x",symlink=False):
  info=zipfile.ZipInfo(name)
  info.create_system=3
  info.external_attr=((stat.S_IFLNK if symlink else stat.S_IFREG)|0o600)<<16
  z.writestr(info,content)
 put("wetudy.dump.enc")
 put("SHA256SUMS.txt")
 if mode=="acl":put("wetudy-acl-snapshot.json.enc")
 if mode=="unexpected":put("../malicious.txt")
 if mode=="absolute":put("/tmp/malicious.txt")
 if mode=="link":put("wetudy-acl-snapshot.json.enc",b"../x",True)
 if mode=="duplicate":put("wetudy.dump.enc",b"another")
 if mode=="nested":put("extra/wetudy.dump.enc")
`;
function attempt(mode){
 const dir=mkdtempSync(join(tmpdir(),"wetudy-safe-zip-"));
 try{
   const zip=join(dir,"backup.zip");
   const make=spawnSync("python3",["-c",makeZip,zip,mode],{encoding:"utf8",timeout:5000});
   assert.equal(make.status,0,make.stderr);
   const run=spawnSync("python3",[script,zip,join(dir,"out")],
     {encoding:"utf8",timeout:5000});
   return run;
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test("encrypted backup ZIP accepts only whitelisted required and optional files",()=>{
 for(const kind of ["normal","acl"]){
  const result=attempt(kind);
  assert.equal(result.status,0,result.stderr);
 }
});
test("ZIP traversal, absolute paths, symlinks, duplicates and extra entries fail closed",()=>{
 for(const kind of ["unexpected","absolute","link","duplicate","nested"]){
  const result=attempt(kind);
  assert.equal(result.status,2,kind);
  assert.match(result.stderr,/BLOCKED/,kind);
 }
});
test("restore validates ZIP before reading encryption material",()=>{
 const scriptText=readFileSync("scripts/pilot-db-restore-drill.sh","utf8");
 const idx=scriptText.indexOf("pilot-safe-encrypted-backup-zip.py");
 assert.ok(idx>0);
 assert.ok(idx < scriptText.indexOf("openssl enc -d"));
 assert.doesNotMatch(scriptText,/unzip -qq/);
 const safe=readFileSync(script,"utf8");
 assert.doesNotMatch(safe,/extractall\(|\.extract\(/);
 const workflow=readFileSync(".github/workflows/pilot-combined-encrypted-recovery.yml","utf8");
 assert.match(workflow,/pilot-safe-encrypted-backup-zip\.py/);
});

test("manifest and ACL envelope size limits are enforced before extraction",()=>{
 const code=readFileSync(script,"utf8");
 assert.match(code,/MAX_MANIFEST_BYTES = 4 \* 1024/);
 assert.match(code,/MAX_ACL_BYTES = 8 \* 1024 \* 1024/);
 assert.match(code,/Excessive ZIP expansion ratio/);
});
