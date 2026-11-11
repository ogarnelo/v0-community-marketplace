import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const script="scripts/pilot-backup-rls-policy-toc-audit.py";
const important=["saved_searches","saved_search_matches",
"user_marketplace_preferences","profiles","listings","listing_photos",
"schools","school_codes","school_access_codes","user_roles","notifications"];
function line(schema,table,idx){
 return `${idx}; 0 0 POLICY ${schema} ${table} qa_policy_${idx} postgres\n`;
}
function fakeToc(nPublic=140,nStorage=3){
 let i=1,out="";
 for(const table of important)out+=line("public",table,i++);
 for(let k=important.length;k<nPublic;k++)out+=line("public","qa_table",i++);
 for(let k=0;k<nStorage;k++)out+=line("storage","objects",i++);
 return out;
}
function run(toc,strict=false){
 const dir=mkdtempSync(join(tmpdir(),"wetudy-rls-toc-"));
 try{
   const f=join(dir,"toc.txt");writeFileSync(f,toc);
   return spawnSync("python3",[script,f,...(strict?["--require-policy-baseline"]:[])],
      {encoding:"utf8",timeout:5000});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test("140 public and 3 storage RLS policy TOC entries are counted; no false certification",()=>{
 const r=run(fakeToc(),true);
 assert.equal(r.status,0,r.stdout+r.stderr);
 const x=JSON.parse(r.stdout);
 assert.equal(x.policy_toc_entries.public,140);
 assert.equal(x.policy_toc_entries.storage,3);
 assert.equal(x.important_public_tables_with_policy_toc,11);
 for(const field of ["sql_grants_recovered_from_no_acl_dump",
  "policies_applied_to_restored_database","rls_runtime_authorization_certified",
  "full_disaster_recovery_certified"])assert.equal(x[field],false);
});
test("missing policy and wrong-schema policy break strict baseline gate",()=>{
 assert.equal(run(fakeToc(139),true).status,2);
 assert.equal(run(fakeToc(140,2),true).status,2);
 const corrupted=fakeToc().replace("POLICY public profiles","POLICY auth profiles");
 const r=run(corrupted,true);
 assert.equal(r.status,2);
 const data=JSON.parse(r.stdout);
 assert.equal(data.important_policy_table_coverage,false);
 assert.equal(data.policy_toc_entries.public,139);
});
test("informational mode reports missing policies without suppressing detection",()=>{
 const result=run("test string POLICY public listings\n");
 assert.equal(result.status,0);
 const data=JSON.parse(result.stdout);
 assert.equal(data.policy_toc_entries.public,0);
 assert.equal(data.public_policy_count_matches_baseline,false);
 assert.equal(data.full_disaster_recovery_certified,false);
});
test("same encrypted restore workflow inspects TOC before any real row restore",()=>{
 const code=readFileSync("scripts/pilot-db-restore-drill.sh","utf8");
 const start=code.indexOf("pilot-backup-rls-policy-toc-audit.py");
 const restore=code.indexOf("--table=school_directory");
 assert.ok(start>=0&&restore>start);
 const workflow=readFileSync(".github/workflows/pilot-combined-encrypted-recovery.yml","utf8");
 assert.match(workflow,/scripts\/pilot-backup-rls-policy-toc-audit\.py/);
 const scriptBody=readFileSync(script,"utf8");
 assert.doesNotMatch(scriptBody,/import subprocess|psycopg|SUPABASE_SERVICE_ROLE_KEY|BACKUP_ENCRYPTION_PASSWORD/);
});
