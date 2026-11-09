#!/usr/bin/env node
"use strict";
// Operational resilience gate: restart ONLY localhost Supabase CLI GoTrue
// from the ephemeral GitHub runner after its full browser/restore tests.
// This tests a service restart, NOT restoration of a different Auth DB.
const assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const api=process.env.LOCAL_SUPABASE_URL||"";
const anon=process.env.LOCAL_SUPABASE_ANON_KEY||"";
const db=process.env.LOCAL_DB_URL||"";
const validLocal=u=>{
  try{let x=new URL(u);return ["127.0.0.1","localhost","[::1]","::1"].includes(x.hostname)}
  catch{return false}
};
if(!validLocal(api)||!validLocal(db)||!api.startsWith("http://")||!anon){
  throw Error("Refusing non-local GoTrue restart health drill");
}
const expected="supabase_auth_wetudy-email-next-stack";
const actual=execFileSync("docker",["ps","--format","{{.Names}}"],{
  encoding:"utf8",timeout:8000
}).trim().split("\n");
if(!actual.includes(expected))throw Error("Exact disposable local GoTrue container not found");
const users=[
  ["qa-email-pkce-family@example.invalid","Local-QA-EmailConfirm-2026!X3a"],
  ["qa-authform-family@example.invalid","New-Local-QA-Password-2026!R7"],
];
async function signIn(email,password){
  const response=await fetch(new URL("/auth/v1/token?grant_type=password",api),{
    method:"POST",
    headers:{"apikey":anon,"Content-Type":"application/json"},
    body:JSON.stringify({email,password}),
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw Error("Local GoTrue sign-in failed after restart: "+response.status);
  const data=await response.json();
  assert.ok(data.access_token&&data.user?.id);
  const res=await fetch(new URL("/rest/v1/profiles?select=id,school_id",api),{
    headers:{"apikey":anon,"Authorization":"Bearer "+data.access_token},
    signal:AbortSignal.timeout(12000)
  });
  assert.equal(res.status,200,"Restored GoTrue login must authorize PostgREST");
  const rows=await res.json();
  assert.equal(rows.length,1,"Logged-in family must see only own RLS profile");
  assert.equal(rows[0].id,data.user.id);
  assert.equal(rows[0].school_id,"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  return data.user.id;
}
(async()=>{
  const before=await Promise.all(users.map(args=>signIn(...args)));
  assert.notEqual(before[0],before[1]);
  execFileSync("docker",["restart","--time","4",expected],{
    encoding:"utf8",timeout:35000,stdio:["ignore","pipe","pipe"]
  });
  let ready=false;
  for(let i=0;i<35;i++){
    try{
      const health=await fetch(new URL("/auth/v1/health",api),
       {headers:{"apikey":anon},signal:AbortSignal.timeout(2500)});
      if(health.ok){ready=true;break}
    }catch{}
    await new Promise(done=>setTimeout(done,900));
  }
  assert.ok(ready,"Restarted disposable GoTrue did not become healthy");
  const after=await Promise.all(users.map(args=>signIn(...args)));
  assert.deepEqual(after,before,"GoTrue identities changed across local service restart");
  console.log("PASS disposable GoTrue restart: both confirmed families sign in, persistent IDs, "
    +"school membership and one-row RLS visibility survive container restart.");
  console.log("LIMIT: service continuity against ORIGINAL local PostgreSQL, not cold recovery "
    +"from backup into a new GoTrue server or production DR.");
})().catch(e=>{console.error("FAIL local GoTrue restart QA:",e.message);process.exitCode=1});
