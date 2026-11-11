#!/usr/bin/env node
// WETUDY P0 #375: compare BEFORE/AFTER PostgreSQL ACL evidence, fail closed.
// Reads JSON metadata files only; never connects to a DB, never runs SQL.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const THREE=["saved_searches","saved_search_matches",
  "user_marketplace_preferences"];
export const WAVE_ONE=["profiles","listings","listing_photos","schools",
  "school_codes","school_access_codes","user_roles","notifications"];
export const ROLES=["anon","authenticated"];
export const PRIVILEGES=["SELECT","INSERT","UPDATE","DELETE",
  "TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"];
export const REMOVED=new Set(["TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"]);
const ALL=[...THREE,...WAVE_ONE];
const REQUIRED_FIELDS=["table_name","grantee_role","privilege_name",
  "effective_privilege","direct_grant_count","direct_grantors",
  "direct_grant_option"];
const own=(o,p)=>Object.prototype.hasOwnProperty.call(o,p);
const keyOf=(r)=>[r.table_name,r.grantee_role,r.privilege_name].join("|");
function assert(ok,msg){if(!ok)throw new Error(msg);}
function validate(data,label){
  assert(Array.isArray(data),label+": expected JSON array");
  const items=new Map();
  for(const row of data){
    assert(row && typeof row==="object" && !Array.isArray(row),label+": invalid row");
    for(const field of REQUIRED_FIELDS)assert(own(row,field),label+": missing field "+field);
    assert(ALL.includes(row.table_name),label+": unexpected table");
    assert(ROLES.includes(row.grantee_role),label+": unexpected role");
    assert(PRIVILEGES.includes(row.privilege_name),label+": unexpected privilege");
    assert(typeof row.effective_privilege==="boolean",label+": invalid effective privilege");
    assert(Number.isInteger(row.direct_grant_count) &&
      row.direct_grant_count>=0,label+": invalid direct count");
    assert(typeof row.direct_grantors==="string",label+": invalid grantors");
    assert(typeof row.direct_grant_option==="boolean",label+": invalid grant option");
    assert((row.direct_grant_count>0)===Boolean(row.direct_grantors),
      label+": inconsistent grantor metadata");
    const key=keyOf(row);
    assert(!items.has(key),label+": duplicate "+key);
    items.set(key,row);
  }
  assert(items.size===ALL.length*ROLES.length*PRIVILEGES.length,
    label+": incomplete evidence "+items.size+"/176");
  return items;
}
export function compareAcl(beforeRows,afterRows,phase){
  assert(["three","eleven"].includes(phase),"invalid phase");
  const before=validate(beforeRows,"before");
  const after=validate(afterRows,"after");
  const targets=new Set(phase==="three"?THREE:ALL);
  let checked=0,revoked=0,preserved=0;
  for(const [key,old] of before){
    const next=after.get(key);
    assert(next,"after missing "+key);
    const removing=targets.has(old.table_name) && REMOVED.has(old.privilege_name);
    if(removing){
      assert(!next.effective_privilege && next.direct_grant_count===0 &&
        next.direct_grantors==="" && !next.direct_grant_option,
        "grant not fully removed (including inherited privilege): "+key);
      // A previously-ungranted privilege must not silently appear and vanish:
      // the comparison never assumes it was originally granted.
      if(old.effective_privilege)revoked++;
    }else{
      for(const field of REQUIRED_FIELDS.slice(3))
        assert(old[field]===next[field],
          "unexpected ACL change "+key+" field "+field);
      preserved++;
    }
    checked++;
  }
  return {ready:true,phase,compared:checked,revoked,preserved,
    target_tables:targets.size,other_tables:ALL.length-targets.size};
}
function main(){
  const [beforeFile,afterFile,phase]=process.argv.slice(2);
  assert(Boolean(beforeFile&&afterFile&&phase),
    "Usage: node scripts/pilot-acl-delta-verify.mjs BEFORE.json AFTER.json three|eleven");
  const result=compareAcl(JSON.parse(readFileSync(beforeFile,"utf8")),
    JSON.parse(readFileSync(afterFile,"utf8")),phase);
  console.log(JSON.stringify(result));
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  try{main()}catch(err){
    console.error("BLOCKED: "+String(err.message));
    process.exitCode=2;
  }
}
