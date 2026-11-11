import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
const path="scripts/pilot-real-policy-restore-drill.py";
function runSelection(lines){
  const dir=mkdtempSync(join(tmpdir(),"wetudy-real-policy-"));
  const file=join(dir,"toc.txt");
  try{
    writeFileSync(file,lines.join("\n")+"\n");
    return spawnSync("python3",["-c",
      "import importlib.util,sys,pathlib;sys.path.insert(0,'scripts');"+
      "s=importlib.util.spec_from_file_location('q',sys.argv[1]);"+
      "m=importlib.util.module_from_spec(s);s.loader.exec_module(m);"+
      "print(m.select_policies(pathlib.Path(sys.argv[2]).read_text()))",path,file],
      {encoding:"utf8",timeout:5000});
  }finally{rmSync(dir,{recursive:true,force:true});}
}
const own=["1001; 0 0 POLICY public saved_search_matches saved_search_matches_select_own postgres",
           "1002; 0 0 POLICY public saved_search_matches saved_search_matches_delete_own postgres"];
test("policy script compiles and refuses to restore incomplete real backup",()=>{
 const syntax=spawnSync("python3",["-c",
   "import ast,pathlib;ast.parse(pathlib.Path('"+path+"').read_text())"],
   {encoding:"utf8",timeout:5000});
 assert.equal(syntax.status,0,syntax.stderr);
 for(const bad of [[],own.slice(0,1),[...own,own[0]],
   own.map(x=>x.replace("public","auth")),
   own.map(x=>x.replace("saved_search_matches","saved_searches"))]){
   assert.notEqual(runSelection(bad).status,0);
 }
});
test("only exact two real saved_search_matches policies are selected",()=>{
 const lines=[...own,
   "1003; 0 0 POLICY public saved_searches saved_searches_select_authorized postgres",
   "1004; 0 0 POLICY storage objects storage_read_own postgres"];
 const r=runSelection(lines);
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/saved_search_matches_select_own/);
 assert.match(r.stdout,/saved_search_matches_delete_own/);
 assert.doesNotMatch(r.stdout,/saved_searches|storage/);
});
test("restoration is forced to an isolated PG17 db and uses no archive data",()=>{
 const code=readFileSync(path,"utf8");
 assert.match(code,/Refusing nonlocal or unexpected PostgreSQL source/);
 assert.match(code,/Refusing to overwrite an existing local QA database/);
 assert.match(code,/drop database if exists/);
 assert.match(code,/pg_restore/);
 assert.match(code,/--schema-only/);
 assert.match(code,/--use-list/);
 assert.match(code,/--no-acl/);
 assert.match(code,/SET LOCAL ROLE authenticated/);
 assert.match(code,/cross_delete=/);
 assert.match(code,/own_delete=/);
 assert.match(code,/visible=/);
 assert.doesNotMatch(code,/--data-only|INSERT INTO auth\.users|BACKUP_DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
});
test("existing encrypted drill invokes RLS restoration before any directory row restore",()=>{
 const restore=readFileSync("scripts/pilot-db-restore-drill.sh","utf8");
 assert.match(restore,/pilot-real-policy-restore-drill\.py/);
 assert.ok(restore.indexOf("pilot-real-policy-restore-drill.py") <
   restore.indexOf("--table=school_directory"));
 const workflow=readFileSync(".github/workflows/pilot-combined-encrypted-recovery.yml","utf8");
 assert.match(workflow,/scripts\/pilot-real-policy-restore-drill\.py/);
});

test("both synthetic owners and missing JWT must be checked after real policy restore",()=>{
 const code=readFileSync(path,"utf8");
 for(const expected of [
  "owner1_visible=1","owner1_cross_delete=0","owner1_own_delete=1",
  "owner2_visible=1","owner2_cross_delete=0",
  "missing_jwt_visible=0","missing_jwt_delete=0","remaining=1",
  "absent_jwt_visible=0","absent_jwt_delete=0",
  "owner2_own_delete=1","remaining_after_both=0"
 ])assert.ok(code.includes(expected),expected);
 assert.match(code,/set_config\('request\.jwt\.claim\.sub','',true\)/);
 assert.match(code,/ID2/);
 assert.match(code,/mutual owner \/ missing-JWT checks/);
 assert.match(code,/--schema-only/);
 assert.doesNotMatch(code,/--data-only|INSERT INTO auth\.users/);
});

test("missing-claim path must use a distinct PostgreSQL connection",()=>{
 const code=readFileSync(path,"utf8");
 assert.match(code,/no_claim_checks = psql\(dest/);
 assert.match(code,/second_owner_checks = psql\(dest/);
 assert.ok(code.indexOf("no_claim_checks = psql") < code.indexOf("second_owner_checks = psql"));
 assert.match(code,/SET LOCAL ROLE authenticated;/);
});
