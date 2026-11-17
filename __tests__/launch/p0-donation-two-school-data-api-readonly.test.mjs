import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateFixture,runProbe} from "../../scripts/p0_donation_two_school_data_api_read_only.mjs";

const ids=["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222",
"33333333-3333-4333-8333-333333333333","44444444-4444-4444-8444-444444444444",
"55555555-5555-4555-8555-555555555555","66666666-6666-4666-8666-666666666666"];
const env={
 WETUDY_E2E_SUPABASE_URL:"https://synthetic.supabase.co",WETUDY_E2E_ANON_KEY:"PUBLIC_TEST_KEY",
 WETUDY_E2E_JWT_A:"SYNTHETIC_JWT_A",WETUDY_E2E_JWT_B:"SYNTHETIC_JWT_B",
 WETUDY_E2E_USER_A:ids[0],WETUDY_E2E_USER_B:ids[1],
 WETUDY_E2E_SCHOOL_A:ids[2],WETUDY_E2E_SCHOOL_B:ids[3],
 WETUDY_E2E_REQUEST_A:ids[4],WETUDY_E2E_REQUEST_B:ids[5],
};
const json=x=>new Response(JSON.stringify(x),{status:200,headers:{"Content-Type":"application/json"}});
function mockTransport(extra={}) {
 const requests=[];
 const fetchImpl=async(url,opts)=>{
   requests.push({url,method:opts.method,authorization:opts.headers.Authorization});
   const a=opts.headers.Authorization==="Bearer SYNTHETIC_JWT_A";
   const me=a?0:1;
   if(url.includes("/auth/v1/user")) return json({id:ids[me]});
   const target=url.includes(ids[4])?0:1;
   if(extra.leak || me===target) return json([{id:ids[4+target],requester_id:ids[target],school_id:ids[2+target]}]);
   return json([]);
 };
 return {fetchImpl,requests};
}
test("real-token fixture requires two distinct schools/users/requests",()=>{
 assert.throws(()=>validateFixture({}),/INVALID_URL/);
 assert.throws(()=>validateFixture({...env,WETUDY_E2E_SCHOOL_B:ids[2]}),/TWO_DIFFERENT/);
 assert.throws(()=>validateFixture({...env,WETUDY_E2E_JWT_B:"SYNTHETIC_JWT_A"}),/TWO_DISTINCT/);
});
test("two distinct authenticated profiles own records and cannot read the opposite record",async()=>{
 const f=validateFixture(env),transport=mockTransport();
 const result=await runProbe(f,{fetchImpl:transport.fetchImpl});
 assert.deepEqual(result,{ok:true,check:"SELECT_RLS_TWO_SCHOOLS",pairs:2,writeOperations:0});
 assert.equal(transport.requests.length,6);
 assert.ok(transport.requests.every(x=>x.method==="GET"));
 assert.ok(transport.requests.every(x=>x.authorization.startsWith("Bearer ")));
});
test("cross-school leak is a failing result, not green CI",async()=>{
 await assert.rejects(runProbe(validateFixture(env),{fetchImpl:mockTransport({leak:true}).fetchImpl}),/CROSS_SCHOOL_REQUEST_VISIBLE/);
});
test("empty fixtures never count as passing E2E",async()=>{
 const transport=mockTransport();
 const fetchImpl=async(url,opts)=>url.includes("/auth/v1/user")?transport.fetchImpl(url,opts):json([]);
 await assert.rejects(runProbe(validateFixture(env),{fetchImpl}),/OWN_FIXTURE_NOT_VISIBLE/);
});
test("script cannot mutate and is not wired to CI against production",()=>{
 const source=readFileSync("scripts/p0_donation_two_school_data_api_read_only.mjs","utf8");
 assert.match(source,/method:"GET"/);
 assert.doesNotMatch(source,/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
 assert.doesNotMatch(source,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
 const workflows=readFileSync(".github/workflows/contracts.yml","utf8");
 assert.doesNotMatch(workflows,/node scripts\/p0_donation_two_school_data_api_read_only\.mjs/);
});
