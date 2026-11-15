#!/usr/bin/env node
// WETUDY #447: Real PostgREST HTTP surface against disposable PostgreSQL 17.
// CI-only with fixed SYNTHETIC secret, UUIDs and 127.0.0.1. No production keys.
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {execFileSync} from "node:child_process";

const JWT_SECRET="ci_only_wetudy_postgrest_jwt_secret_2026_not_prod";
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const BASE="http://127.0.0.1:3000/listings";
const safeEnv=process.env.WETUDY_SYNTHETIC_POSTGRES_CI==="yes"
  && process.env.WETUDY_POSTGREST_HTTP_CI==="yes"
  && process.env.PGHOST==="127.0.0.1"
  && process.env.PGPORT==="5432"
  && process.env.PGUSER==="postgres"
  && process.env.PGPASSWORD==="ci_synthetic_only_not_secret";
if(!safeEnv) throw Error("NO_GO_POSTGREST_NON_SYNTHETIC_CI");
function jwt(id) {
  const base64=s=>Buffer.from(JSON.stringify(s)).toString("base64url");
  const content=base64({alg:"HS256",typ:"JWT"})+"."+base64({
    role:"authenticated",sub:id,exp:Math.floor(Date.now()/1000)+600,
  });
  const sig=createHmac("sha256",JWT_SECRET).update(content).digest("base64url");
  return content+"."+sig;
}
function fail(code) {throw Error("NO_GO_POSTGREST_"+code)}
const req=async (method,url,body,subject) => {
  const headers={"Accept":"application/json"};
  if(subject)headers.Authorization="Bearer "+jwt(subject);
  if(body!==undefined){
    headers["Content-Type"]="application/json";
    headers["Prefer"]="return=minimal";
  }
  try{
    const response=await fetch(url,{
      method,headers,body:body===undefined?undefined:JSON.stringify(body),
      redirect:"error",signal:AbortSignal.timeout(2500)
    });
    const raw=await response.text();
    let data;
    try{data=raw?JSON.parse(raw):null}catch{data=null}
    return {status:response.status,data};
  }catch{fail("NETWORK")}
};
const expected=(r,allowed,label)=>{
  if(!allowed.includes(r.status))fail(label);
};
const pg=sql=>{
  execFileSync("psql",["-X","-v","ON_ERROR_STOP=1","-d","wetudy_privacy_ci","-c",sql],
    {stdio:"ignore",timeout:5000});
};
async function main(){
  let alive=false;
  for(let tries=0;tries<50;tries++){
    try{
      const r=await fetch(BASE+"?select=id",{signal:AbortSignal.timeout(1200)});
      if(r.status!==503&&r.status!==502&&r.status!==404){alive=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,240));
  }
  if(!alive)fail("NOT_READY");
  const anonGet=await req("GET",BASE+"?select=id%2Cpostal_code");
  expected(anonGet,[401,403],"ANON_SELECT");
  assert.equal(anonGet.data?.code,"42501","anon SELECT must be denied by GRANT");
  const anonInsert=await req("POST",BASE,{id:910003,user_id:A});
  expected(anonInsert,[401,403],"ANON_INSERT");
  const anonPatch=await req("PATCH",BASE+"?id=eq.910001",{postal_code:"00000"});
  expected(anonPatch,[401,403],"ANON_UPDATE");
  const anonDelete=await req("DELETE",BASE+"?id=eq.910001");
  expected(anonDelete,[401,403],"ANON_DELETE");

  // A and B are fake JWT subjects; RLS must constrain real HTTP requests.
  expected(await req("POST",BASE,{id:910001,user_id:A,postal_code:"11111",status:"available"},A),
    [201],"OWNER_A_INSERT");
  expected(await req("POST",BASE,{id:910002,user_id:B,postal_code:"22222",status:"available"},B),
    [201],"OWNER_B_INSERT");
  const aVisible=await req("GET",BASE+"?select=id%2Cpostal_code%2Cuser_id",undefined,A);
  expected(aVisible,[200],"OWNER_A_SELECT");
  if(aVisible.data?.length!==1||aVisible.data[0].id!==910001)fail("FAMILY_A_ISOLATION");
  const bVisible=await req("GET",BASE+"?select=id%2Cpostal_code%2Cuser_id",undefined,B);
  expected(bVisible,[200],"OWNER_B_SELECT");
  if(bVisible.data?.length!==1||bVisible.data[0].id!==910002)fail("FAMILY_B_ISOLATION");
  expected(await req("PATCH",BASE+"?id=eq.910001",{postal_code:"33333"},A),
    [200,204],"OWNER_CP_UPDATE");
  expected(await req("PATCH",BASE+"?id=eq.910002",{postal_code:"99999"},A),
    [200,204],"CROSS_FAMILY_PATCH_DENIED_OR_ZERO");
  const ownA=await req("GET",BASE+"?select=id%2Cpostal_code",undefined,A);
  if(ownA.data?.[0]?.postal_code!=="33333")fail("OWNER_CP_EDIT_NOT_PERSISTED");
  const ownB=await req("GET",BASE+"?select=id%2Cpostal_code",undefined,B);
  if(ownB.data?.[0]?.postal_code!=="22222")fail("CROSS_FAMILY_CP_OVERWRITTEN");
  const crossed=await req("POST",BASE,{id:910004,user_id:B,postal_code:"44444"},A);
  expected(crossed,[401,403],"CROSS_FAMILY_INSERT_DENIED");
  if(crossed.data?.code!=="42501")fail("RLS_NOT_APPLIED");
  pg("DELETE FROM public.listings WHERE id BETWEEN 910000 AND 910999;");
  const remaining=await req("GET",BASE+"?select=id",undefined,A);
  if(remaining.data?.length!==0)fail("CLEANUP");
  console.log("PASS_CI_POSTGREST_PG17_HTTP: anon CRUD denied; 2 fake JWT families isolated; authenticated owner CP edit; cross-owner blocked; no real data");
}
main().catch(err=>{
  console.error(/^NO_GO_POSTGREST_[A-Z_]+$/.test(err.message)?
    err.message:"NO_GO_POSTGREST_ASSERTION");
  process.exitCode=2;
});
