import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {compareAcl,THREE,WAVE_ONE,ROLES,PRIVILEGES,REMOVED} from
  "../../scripts/pilot-acl-delta-verify.mjs";

const ALL=[...THREE,...WAVE_ONE];
function baseline(){
  return ALL.flatMap(table_name=>ROLES.flatMap(grantee_role=>
    PRIVILEGES.map(privilege_name=>({
      table_name,grantee_role,privilege_name,
      effective_privilege:true,direct_grant_count:1,
      direct_grantors:"postgres",direct_grant_option:false
    }))));
}
function hardened(rows,targets){
  return rows.map(row=>
    targets.includes(row.table_name)&&REMOVED.has(row.privilege_name)
      ?{...row,effective_privilege:false,direct_grant_count:0,
         direct_grantors:"",direct_grant_option:false}: {...row});
}
test("the initial three-table ACL phase preserves all DML and unrelated tables",()=>{
  const before=baseline(),after=hardened(before,THREE);
  const result=compareAcl(before,after,"three");
  assert.deepEqual(
    [result.compared,result.revoked,result.preserved,result.target_tables],
    [176,24,152,3]);
  assert.throws(()=>compareAcl(before,after,"eleven"),/grant not fully removed/);
});
test("both stages remove 88 non-RLS grants while preserving 88 ordinary grants",()=>{
  const before=baseline(),after=hardened(before,ALL);
  const result=compareAcl(before,after,"eleven");
  assert.equal(result.revoked,88);
  assert.equal(result.preserved,88);
  assert.equal(result.target_tables,11);
});
test("inherited grants are a failed revocation, even when direct ACL says none",()=>{
  const before=baseline(),after=hardened(before,THREE);
  const i=after.findIndex(r=>r.table_name==="saved_searches" &&
    r.grantee_role==="anon" && r.privilege_name==="TRUNCATE");
  after[i]={...after[i],effective_privilege:true};
  assert.throws(()=>compareAcl(before,after,"three"),/grant not fully removed/);
});
test("unexpected changes to SELECT, DELETE, privilege grantors, or grant option fail",()=>{
  for(const field of ["effective_privilege","direct_grant_count",
    "direct_grantors","direct_grant_option"]){
    const before=baseline(),after=hardened(before,THREE);
    const row=after.find(x=>x.table_name==="listings" &&
      x.grantee_role==="authenticated" && x.privilege_name==="SELECT");
    if(field==="effective_privilege")row[field]=false;
    if(field==="direct_grant_count")row[field]=2;
    if(field==="direct_grantors")row[field]="other_role";
    if(field==="direct_grant_option")row[field]=true;
    assert.throws(()=>compareAcl(before,after,"three"),
      /unexpected ACL change|inconsistent grantor metadata/,field);
  }
});
test("missing, duplicate, changed-role and unsafe privilege evidence fails closed",()=>{
  const before=baseline(),after=hardened(before,THREE);
  assert.throws(()=>compareAcl(before,after.slice(1),"three"),/incomplete evidence/);
  assert.throws(()=>compareAcl(before,[...after,after[0]],"three"),/duplicate/);
  assert.throws(()=>compareAcl(before,after.map((r,i)=>i===0?
    {...r,grantee_role:"service_role"}:r),"three"),/unexpected role/);
  assert.throws(()=>compareAcl(before,after,"unknown"),/invalid phase/);
});
test("CLI consumes saved metadata JSON and rejects a forged restore",()=>{
  const dir=mkdtempSync(join(tmpdir(),"wetudy-acl-delta-"));
  try{
    const first=join(dir,"before.json"),last=join(dir,"after.json");
    writeFileSync(first,JSON.stringify(baseline()));
    writeFileSync(last,JSON.stringify(hardened(baseline(),THREE)));
    const args=["scripts/pilot-acl-delta-verify.mjs",first,last,"three"];
    const r=spawnSync("node",args,{encoding:"utf8",timeout:10000});
    assert.equal(r.status,0,r.stderr);
    assert.equal(JSON.parse(r.stdout).revoked,24);
    const fail=spawnSync("node",[...args.slice(0,3),"eleven"],
      {encoding:"utf8",timeout:10000});
    assert.equal(fail.status,2);
    assert.match(fail.stderr,/BLOCKED/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test("offline validator has no DB, HTTP or process-execution capability",()=>{
  const code=readFileSync("scripts/pilot-acl-delta-verify.mjs","utf8");
  assert.doesNotMatch(code,/pg_dump|pg_restore|psql|fetch\(|https?:\/\/|child_process|execute_sql|supabase-js/);
});
