import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const script="scripts/pilot-managed-schema-toc-coverage.py";
const AUTH=`audit_log_entries custom_oauth_providers flow_state identities instances mfa_amr_claims mfa_challenges mfa_factors mfa_recovery_code_sets mfa_recovery_codes oauth_authorizations oauth_client_states oauth_clients oauth_consents one_time_tokens refresh_tokens saml_providers saml_relay_states schema_migrations scim_tokens scim_users sessions sso_domains sso_providers users webauthn_challenges webauthn_credentials`.split(" ");
const STORAGE=`bucket_lifecycle_states buckets buckets_analytics buckets_vectors lifecycle_abandoned_artifacts migrations objects s3_multipart_uploads s3_multipart_uploads_parts vector_indexes`.split(" ");
function toc(schema,name,kind,index){
 return `${index}; 1259 ${index} ${kind} ${schema} ${name} postgres\n`;
}
function contents(){
 let i=1,out="";
 for(const [schema,tables] of [["auth",AUTH],["storage",STORAGE]]){
   for(const t of tables){out+=toc(schema,t,"TABLE",i++);out+=toc(schema,t,"TABLE DATA",i++);}
 }
 return out;
}
function run(text,strict=false){
 const dir=mkdtempSync(join(tmpdir(),"wetudy-toc-managed-"));
 try{
   const p=join(dir,"toc.txt");writeFileSync(p,text);
   return spawnSync("python3",[script,p,...(strict?["--require-managed-toc"]:[])],
     {encoding:"utf8",timeout:5000});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test("auth 27 and storage 10 table/data TOC sections are counted without reading rows",()=>{
 const r=run(contents(),true);
 assert.equal(r.status,0,r.stderr);
 const json=JSON.parse(r.stdout);
 assert.deepEqual([json.schemas.auth.toc_sections_present,json.schemas.storage.toc_sections_present],[54,20]);
 assert.equal(json.schemas.auth.catalog_tables_expected,27);
 assert.equal(json.schemas.storage.catalog_tables_expected,10);
 assert.equal(json.full_disaster_recovery_certified,false);
 assert.equal(json.physical_storage_object_bytes_recovered,false);
 assert.equal(json.gotrue_runtime_restored,false);
});
test("missing managed sections are reported, and strict mode fails closed",()=>{
 const all=contents();
 const missing=all.replace(/^[^\n]* TABLE DATA auth users postgres\n/m,"");
 const r=run(missing);
 assert.equal(r.status,0);
 const j=JSON.parse(r.stdout);
 assert.equal(j.schemas.auth.toc_sections_present,53);
 assert.equal(j.schemas.auth.toc_complete_for_known_tables,false);
 assert.equal(run(missing,true).status,2);
});
test("spoofed table in public schema never counts as auth managed table",()=>{
 const all=contents();
 const swapped=all.replace(/TABLE auth users postgres/g,"TABLE public users postgres");
 const r=run(swapped,true);
 assert.equal(r.status,2);
});
test("false positives from arbitrary lines cannot imply full recovery",()=>{
 const r=run("untrusted auth users TABLE DATA\n");
 assert.equal(r.status,0);
 const j=JSON.parse(r.stdout);
 assert.equal(j.schemas.auth.toc_sections_present,0);
 assert.equal(j.full_disaster_recovery_certified,false);
});
test("restore uses TOC-only script and never requires personal data restoration",()=>{
 const scriptText=readFileSync(script,"utf8");
 const restore=readFileSync("scripts/pilot-db-restore-drill.sh","utf8");
 assert.match(restore,/pilot-managed-schema-toc-coverage\.py/);
 assert.match(restore,/wetudy-restore\.toc/);
 assert.doesNotMatch(scriptText,/subprocess|import requests|import psycopg|psql\\s+-|SUPABASE_SERVICE_ROLE_KEY|BACKUP_ENCRYPTION_PASSWORD/);
});
