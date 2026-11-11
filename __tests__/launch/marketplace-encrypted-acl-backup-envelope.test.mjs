import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";

const validator="scripts/pilot-backup-acl-snapshot-validate.py";
const backup=readFileSync(".github/workflows/wetudy-encrypted-db-backup.yml","utf8");
const restore=readFileSync("scripts/pilot-db-restore-drill.sh","utf8");
const sql=readFileSync("scripts/pilot-acl-json-snapshot-readonly.sql","utf8");
const tables=["saved_searches","saved_search_matches","user_marketplace_preferences",
 "profiles","listings","listing_photos","schools","school_codes",
 "school_access_codes","user_roles","notifications"];
const perms=["SELECT","INSERT","UPDATE","DELETE","TRUNCATE",
 "REFERENCES","TRIGGER","MAINTAIN"];
function fixture(){
  return tables.flatMap(table_name=>["anon","authenticated"].flatMap(grantee_role=>
    perms.map(privilege_name=>({table_name,grantee_role,privilege_name,
      effective_privilege:true,direct_grant_count:1,direct_grantors:"postgres",
      direct_grant_option:false}))));
}
function run(data){
  const dir=mkdtempSync(join(tmpdir(),"wetudy-acl-backup-"));
  try{
    const p=join(dir,"input.json");
    writeFileSync(p,typeof data==="string"?data:JSON.stringify(data));
    const r=spawnSync("python3",[validator,p],
      {encoding:"utf8",timeout:5000,env:{PATH:process.env.PATH}});
    return r;
  }finally{rmSync(dir,{force:true,recursive:true});}
}
test("canonical encrypted-backup ACL snapshot accepts exactly 176 metadata rows",()=>{
  const r=run(fixture());
  assert.equal(r.status,0,r.stderr);
  const result=JSON.parse(r.stdout);
  assert.equal(result.length,176);
  assert.deepEqual(Object.keys(result[0]).sort(),Object.keys(fixture()[0]).sort());
});
test("the backup ACL validator rejects truncation, duplicates, foreign role, unknown fields",()=>{
  const sample=fixture();
  for(const bad of [
    sample.slice(1), [...sample,sample[0]],
    sample.map((r,i)=>i===0?{...r,grantee_role:"service_role"}:r),
    sample.map((r,i)=>i===0?{...r,email:"private@example.com"}:r),
    sample.map((r,i)=>i===0?{...r,direct_grant_count:-1}:r),
    sample.map((r,i)=>i===0?{...r,effective_privilege:"true"}:r),
    "{not json"
  ]){
    const r=run(bad);
    assert.equal(r.status,2);
    assert.match(r.stderr,/BLOCKED/);
  }
});
test("backup separately encrypts ACL and wipes all plaintext before upload",()=>{
  assert.match(backup,/pg_dump[^\n]*--no-acl/);
  assert.match(backup,/actions\/checkout@/);
  assert.match(backup,/pilot-acl-json-snapshot-readonly\.sql/);
  assert.match(backup,/pilot-backup-acl-snapshot-validate\.py/);
  assert.match(backup,/openssl enc[^\n]*-in backup\/wetudy-acl-snapshot\.json[^\n]*\.enc/);
  assert.match(backup,/cmp backup\/wetudy-acl-snapshot\.json backup\/wetudy-acl-snapshot\.verified/);
  assert.match(backup,/sha256sum backup\/wetudy\.dump\.enc backup\/wetudy-acl-snapshot\.json\.enc/);
  assert.match(backup,/rm -f backup\/wetudy\.dump[^\n]*backup\/wetudy-acl-snapshot\.json/);
  assert.doesNotMatch(backup,/^\s+backup\/wetudy-acl-snapshot\.json\s*$/m);
  assert.doesNotMatch(backup,/^\s+backup\/wetudy-acl-snapshot\.raw\s*$/m);
  assert.match(backup,/retention-days: 7/);
});
test("restore validates new encrypted ACL without exposing grants or breaking legacy archives",()=>{
  assert.match(restore,/if \[\[ -s backup\/wetudy-acl-snapshot\.json\.enc \]\]/);
  assert.match(restore,/python3 "\$repo_root\/scripts\/pilot-backup-acl-snapshot-validate\.py"/);
  assert.match(restore,/LEGACY ARCHIVE: ACL evidence unavailable/);
  assert.match(restore,/validated encrypted ACL metadata|Validated encrypted ACL metadata/);
  assert.doesNotMatch(restore,/GRANT\s+|REVOKE\s+|ALTER DEFAULT PRIVILEGES/);
  assert.match(sql,/BEGIN TRANSACTION READ ONLY;/);
});
