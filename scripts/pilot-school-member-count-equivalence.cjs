#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const db=process.env.DATABASE_URL||"";
const host=new URL(db).hostname;
if(!["localhost","127.0.0.1","[::1]"].includes(host))throw Error("Refusing non-local database");
function run(sql){
 return execFileSync("psql",["-X","-A","-t","-v","ON_ERROR_STOP=1",db,"-c",sql],{
  encoding:"utf8",timeout:45000,maxBuffer:10_000_000
 }).trim();
}
const A="00000000-0000-4000-8000-000000000201";
const B="00000000-0000-4000-8000-000000000202";
function readJson(table,fields,tail=""){
 const q="select coalesce(json_agg(t),'[]'::json) from (select "+fields+" from public."+table+" "+tail+") t";
 return JSON.parse(run(q));
}
function countOriginal(school,profiles,active,roles){
 const schoolOwnerIds=new Set(active.filter(c=>c.school_id===school).map(c=>c.owner_user_id));
 const allActiveOwners=new Set(active.map(c=>c.owner_user_id));
 for(const role of roles.filter(r=>r.role==="school_admin"&&r.school_id===school)){
   schoolOwnerIds.add(role.user_id);
 }
 return profiles.filter(p=>schoolOwnerIds.has(p.id) ||
       (!allActiveOwners.has(p.id)&&p.school_id===school)).length;
}
function sqlCount(school){return Number(run("select public.server_school_member_count('"+school+"')"));}
function compare(label){
 const profiles=readJson("profiles","id,school_id","limit 10000");
 const active=readJson("account_students","owner_user_id,school_id","where active=true limit 20000");
 const roles=readJson("user_roles","user_id,role,school_id");
 for(const school of [A,B]){
   const expected=countOriginal(school,profiles,active,roles);
   const actual=sqlCount(school);
   assert.equal(actual,expected,label+" SQL/JS mismatch for "+school);
   console.log("MATCH",label,school===A?"A":"B","members:",actual);
 }
}
compare("base fixture");
run([
"insert into public.profiles(id,school_id)",
"select ('10000000-0000-4000-8000-'||lpad(to_hex(n),12,'0'))::uuid,",
"       case when n%7=0 then null::uuid",
"            when n%3=0 then '"+B+"'::uuid",
"            else '"+A+"'::uuid end",
"from generate_series(1,360) n;",
"insert into public.account_students(id,owner_user_id,school_id,active)",
"select ('20000000-0000-4000-8000-'||lpad(to_hex(n),12,'0'))::uuid,",
"       ('10000000-0000-4000-8000-'||lpad(to_hex((n+1)/2),12,'0'))::uuid,",
"       case when n%4=0 then '"+B+"'::uuid",
"            when n%11=0 then null::uuid",
"            else '"+A+"'::uuid end,",
"       n%6<>0",
"from generate_series(1,720) n;",
"insert into public.user_roles(id,user_id,school_id,role)",
"select ('30000000-0000-4000-8000-'||lpad(to_hex(n),12,'0'))::uuid,",
"       ('10000000-0000-4000-8000-'||lpad(to_hex(n),12,'0'))::uuid,",
"       case when n%2=0 then '"+B+"'::uuid else '"+A+"'::uuid end,",
"       'school_admin' from generate_series(1,360) n where n%13=0;"
].join("\n"));
compare("mixed 360 profiles and 720 student contexts");
run([
"create index qa_active_students_owner_school on public.account_students(owner_user_id,school_id) where active;",
"create index qa_roles_admin_user_school on public.user_roles(user_id,school_id) where role='school_admin';",
"insert into public.profiles(id,school_id)",
"select ('40000000-0000-4000-8000-'||lpad(to_hex(n),12,'0'))::uuid,",
"       '"+A+"'::uuid from generate_series(1,10200) n;"
].join("\n"));
const cappedProfiles=readJson("profiles","id,school_id","limit 10000");
const activeContexts=readJson("account_students","owner_user_id,school_id","where active=true limit 20000");
const schoolRoles=readJson("user_roles","user_id,role,school_id");
const cappedCount=countOriginal(A,cappedProfiles,activeContexts,schoolRoles);
const uncappedCount=sqlCount(A);
assert.ok(uncappedCount>cappedCount,
 "Expected global profile 10k cap undercount. Actual "+uncappedCount+" vs capped "+cappedCount);
console.log("CAP REPRODUCED: old client A count",cappedCount,"vs complete SQL A count",uncappedCount);
assert.equal(sqlCount("99999999-9999-4999-8999-999999999999"),0);
console.log("PASS: same JS semantics below cap; SQL complete count avoids demonstrable 10k profile truncation.");
console.log("LIMIT: synthetic data, no real production EXPLAIN or migration.");
