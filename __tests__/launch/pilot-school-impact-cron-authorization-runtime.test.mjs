import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const ts = createRequire(import.meta.url)("typescript");
const SCHOOL = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const SUB = "33333333-3333-4333-8333-333333333333";

function fixture(options = {}) {
  const events = [];
  const logs = [];
  const output = {};
  const subscription = {
    id: SUB, school_id: SCHOOL, user_id: USER,
    email: "school@example.invalid", day_of_month: 17, last_sent_month: null,
  };
  const admin = {
    auth: { admin: { getUserById: async () => {
      events.push("ACCOUNT");
      return {data:{user:{id:USER,email:options.mismatchedEmail
        ? "other@example.invalid":"school@example.invalid",
        email_confirmed_at:options.unverified?null:"2026-11-01T00:00:00Z"}},error:null};
    } } },
    from(table) {
      events.push("FROM:"+table);
      const q = {
        select: () => q, eq: () => q,
        returns: async () => ({data:[subscription],error:options.subscriptionError?{message:"PRIVATE_SUBSCRIPTION_SQL"}:null}),
        maybeSingle: async () => {
          if (table === "user_roles") return {
            data:options.revokedRole?null:{user_id:USER},error:null,
          };
          if (table === "schools") return {
            data:options.missingSchool?null:{id:SCHOOL,is_active:!options.inactiveSchool},
            error:options.schoolError?{message:"PRIVATE_SCHOOL_SQL"}:null,
          };
          throw Error("Unexpected maybeSingle: "+table);
        },
        insert: () => { events.push("DELIVERY"); return q; },
        update: () => { events.push("UPDATE"); return q; },
        then: (resolve, reject) => Promise.resolve({error:options.deliveryError && table==="school_impact_report_deliveries"?{message:"PRIVATE_DELIVERY_SQL"}:null}).then(resolve,reject),
      };
      return q;
    },
  };
  const mocks = {
    "@/lib/supabase/admin":{createAdminClient:()=>admin},
    "@/lib/reports/school-impact-report":{
      loadSchoolImpactReport:async()=>{events.push("REPORT");return {
        school:{is_active:!options.reportInactive},
      };},
      previousCalendarMonth:()=>({start:"2026-10-01",end:"2026-10-31",
        label:"octubre 2026",key:"2026-10"}),
      renderSchoolImpactPdf:()=>{events.push("PDF");return new Uint8Array();},
    },
    "@/lib/emails/school-impact-report-email":{
      sendMonthlySchoolImpactEmail:async()=>{events.push("EMAIL");return {id:"mock-email-id"};},
    },
  };
  const source=readFileSync("app/api/cron/school-impact-reports/route.ts","utf8");
  const js=ts.transpileModule(source,{fileName:"cron.ts",reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
      esModuleInterop:true}});
  assert.equal((js.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  vm.runInNewContext(js.outputText,{
    exports:output,require:name=>{
      assert.ok(name in mocks,"Unexpected dependency "+name);
      return mocks[name];
    },
    process:{env:{CRON_SECRET:"synthetic-secret"}},
    Intl,Date,Response,Request,Promise,console:{error:(...args)=>logs.push(args)},
  },{filename:"school-impact-cron.js",timeout:1800});
  return {events,logs,run:async()=>{
    const response=await output.GET(new Request("https://wetudy.invalid/api/cron/school-impact-reports",{
      headers:{authorization:"Bearer synthetic-secret"},
    }));
    return {status:response.status,body:await response.json()};
  }};
}

test("inactive school stops before report, PDF or delivery",async()=>{
  const h=fixture({inactiveSchool:true}),result=await h.run();
  assert.equal(result.status,200);
  assert.equal(result.body.sent,0);
  assert.equal(result.body.skipped,1);
  for(const forbidden of ["REPORT","PDF","EMAIL","DELIVERY","UPDATE"])
    assert.equal(h.events.includes(forbidden),false,forbidden);
});
test("missing school stops before privileged report load",async()=>{
  const h=fixture({missingSchool:true}); const result=await h.run();
  assert.equal(result.body.sent,0);assert.equal(result.body.skipped,1);
  assert.equal(h.events.includes("REPORT"),false);
});
test("revoked school admin role prevents school lookup, PDF and email",async()=>{
  const h=fixture({revokedRole:true}),result=await h.run();
  assert.equal(result.body.sent,0);assert.equal(result.body.skipped,1);
  assert.equal(h.events.some(e=>e==="FROM:schools"),false);
  assert.equal(h.events.includes("EMAIL"),false);
});
test("legacy third-party recipient is suppressed even with valid school role",async()=>{
  const h=fixture({mismatchedEmail:true}),result=await h.run();
  assert.equal(result.body.skipped,1);
  assert.equal(h.events.includes("REPORT"),false);
  assert.equal(h.events.includes("EMAIL"),false);
});
test("school lookup outage fails closed without sending email",async()=>{
  const h=fixture({schoolError:true}),result=await h.run();
  assert.equal(result.body.failed,1);
  assert.equal(result.body.sent,0);
  assert.equal(h.events.includes("REPORT"),false);
  assert.equal(h.events.includes("EMAIL"),false);
});
test("verified admin of active school sends one synthetic report",async()=>{
  const h=fixture(),result=await h.run();
  assert.equal(result.body.sent,1);
  assert.equal(result.body.failed,0);
  assert.equal(result.body.unrecorded,0);
  for(const required of ["REPORT","PDF","EMAIL","DELIVERY","UPDATE"])
    assert.equal(h.events.includes(required),true,required);
});

test("cron subscription read error redacts provider messages",async()=>{
 const h=fixture({subscriptionError:true}),result=await h.run();
 assert.equal(result.status,500);
 assert.equal(h.events.includes("EMAIL"),false);
 assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_SUBSCRIPTION_SQL|school@example/);
});
test("per-subscription failures are aggregate-only without subscriber IDs",async()=>{
 const h=fixture({schoolError:true}),result=await h.run();
 assert.equal(result.body.failed,1);
 assert.equal(result.body.sent,0);
 assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_SCHOOL_SQL|33333333-3333-4333/);
 assert.equal(h.events.includes("EMAIL"),false);
});
test("post-send delivery SQL diagnostics are never included in cron logs",async()=>{
 const h=fixture({deliveryError:true}),result=await h.run();
 assert.equal(result.body.sent,1);
 assert.equal(result.body.failed,0);
 assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_DELIVERY_SQL|33333333-3333-4333/);
});

test("provider acceptance with failed audit row is visible without requesting a resend",async()=>{
  const h=fixture({deliveryError:true}),result=await h.run();
  assert.equal(result.body.sent,1);
  assert.equal(result.body.failed,0);
  assert.equal(result.body.unrecorded,1);
  assert.equal(result.body.ok,false);
  assert.equal(h.events.filter(x=>x==="EMAIL").length,1);
  assert.equal(h.events.includes("UPDATE"),true);
  assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_DELIVERY_SQL|school@example.invalid|33333333-3333/);
});
