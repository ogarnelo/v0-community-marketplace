// WETUDY #591: opt-in, READ-ONLY Data API probe using two legitimately obtained JWTs.
// No database writes, no secret output, and no fake "PASS" when fixtures are missing.
// This tests SELECT isolation. INSERT RLS requires separate explicitly approved tests.
import {pathToFileURL} from "node:url";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(value,name) {
  if (!uuid.test(value??"")) throw new Error("INVALID_FIXTURE_"+name);
  return value.toLowerCase();
}
export function validateFixture(env) {
  const url=env.WETUDY_E2E_SUPABASE_URL;
  if(!url || !/^https:\/\/[a-z0-9.-]+$/i.test(url)) throw new Error("INVALID_URL");
  const apikey=env.WETUDY_E2E_ANON_KEY,tokenA=env.WETUDY_E2E_JWT_A,tokenB=env.WETUDY_E2E_JWT_B;
  if(!apikey || !tokenA || !tokenB || tokenA===tokenB) throw new Error("TWO_DISTINCT_AUTH_SESSIONS_REQUIRED");
  const a={user:validId(env.WETUDY_E2E_USER_A,"USER_A"),
    school:validId(env.WETUDY_E2E_SCHOOL_A,"SCHOOL_A"),
    request:validId(env.WETUDY_E2E_REQUEST_A,"REQUEST_A"),jwt:tokenA};
  const b={user:validId(env.WETUDY_E2E_USER_B,"USER_B"),
    school:validId(env.WETUDY_E2E_SCHOOL_B,"SCHOOL_B"),
    request:validId(env.WETUDY_E2E_REQUEST_B,"REQUEST_B"),jwt:tokenB};
  if(a.user===b.user || a.school===b.school || a.request===b.request)
    throw new Error("TWO_DIFFERENT_SCHOOLS_USERS_AND_REQUESTS_REQUIRED");
  return {url,apikey,a,b};
}
async function getJson(fetchImpl,url,apikey,token){
  const response=await fetchImpl(url,{
    method:"GET",redirect:"error",
    headers:{apikey,Authorization:"Bearer "+token,Accept:"application/json"},
  });
  if(!response.ok) throw new Error("DATA_API_HTTP_"+response.status);
  const body=await response.json();
  return body;
}
async function authIdentity(fetchImpl,fixture,actor) {
  const user=await getJson(fetchImpl,fixture.url+"/auth/v1/user",fixture.apikey,actor.jwt);
  if(!user || typeof user!=="object" || user.id?.toLowerCase()!==actor.user)
    throw new Error("SESSION_IDENTITY_MISMATCH");
}
async function getRequest(fetchImpl,fixture,actor,requestId){
  const url=fixture.url+"/rest/v1/donation_requests?select=id,requester_id,school_id&id=eq."+requestId;
  const rows=await getJson(fetchImpl,url,fixture.apikey,actor.jwt);
  if(!Array.isArray(rows)) throw new Error("UNEXPECTED_DATA_API_SHAPE");
  return rows;
}
export async function runProbe(fixture,{fetchImpl=fetch}={}){
  // Validate both sessions before any RLS claim. JWTs are never logged or persisted.
  await authIdentity(fetchImpl,fixture,fixture.a);
  await authIdentity(fetchImpl,fixture,fixture.b);
  for(const [own,other] of [[fixture.a,fixture.b],[fixture.b,fixture.a]]){
    const owned=await getRequest(fetchImpl,fixture,own,own.request);
    if(owned.length!==1 || owned[0]?.id?.toLowerCase()!==own.request ||
       owned[0]?.requester_id?.toLowerCase()!==own.user ||
       owned[0]?.school_id?.toLowerCase()!==own.school)
      throw new Error("OWN_FIXTURE_NOT_VISIBLE_OR_INVALID");
    const cross=await getRequest(fetchImpl,fixture,own,other.request);
    if(cross.length!==0) throw new Error("CROSS_SCHOOL_REQUEST_VISIBLE");
  }
  // This means READ isolation with 2 real requests PASS, not INSERT or full E2E PASS.
  return {ok:true,check:"SELECT_RLS_TWO_SCHOOLS",pairs:2,writeOperations:0};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    const fixture=validateFixture(process.env);
    const result=await runProbe(fixture);
    process.stdout.write(JSON.stringify(result)+"\n");
  } catch (err) {
    const known=String(err?.message||"UNKNOWN");
    // Do not echo unknown provider errors: they could embed JWTs, PII, or URLs.
    const allow=/^(?:INVALID_|TWO_|SESSION_|DATA_API_HTTP_\d{3}$|UNEXPECTED_|OWN_|CROSS_)/;
    process.stderr.write("READ_ONLY_E2E_NOT_PASSED: "+(allow.test(known)?known:"PRIVATE_ERROR")+"\n");
    process.exitCode=1;
  }
}
