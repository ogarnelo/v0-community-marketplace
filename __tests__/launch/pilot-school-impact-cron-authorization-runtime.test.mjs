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
  let accountReads = 0, roleReads = 0, schoolReads = 0;
  const subscription = {
    id: SUB, school_id: SCHOOL, user_id: USER,
    email: "school@example.invalid",
    day_of_month: Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",day:"numeric"}).format(new Date())),
    last_sent_month: null,
  };
  const admin = {
    auth: { admin: { getUserById: async () => {
      accountReads++;
      events.push("ACCOUNT");
      return {data:{user:{id:options.wrongUserId?"33333333-3333-4333-8333-333333333333":USER,email:options.mismatchedEmail ||
          options.emailChangedDuringReport && accountReads > 1
        ? "other@example.invalid":"school@example.invalid",
        email_confirmed_at:options.unverified ||
          options.unverifiedDuringReport && accountReads > 1
          ? null:"2026-11-01T00:00:00Z"}},
        error:options.accountOutage || options.accountRecheckError && accountReads > 1
          ? new Error("PRIVATE_ACCOUNT") : null};
    } } },
    from(table) {
      events.push("FROM:"+table);
      let selectedColumns = "";
      const q = {
        select: (columns) => {selectedColumns=String(columns);return q;}, eq: () => q, limit: () => q,
        is: (column,value) => { if (column==="last_sent_month") events.push("MARKER_IS_NULL:"+String(value));return q; },
        returns: async () => ({data:[subscription],error:options.subscriptionError?{message:"PRIVATE_SUBSCRIPTION_SQL"}:null}),
        maybeSingle: async () => {
          if (table === "school_impact_report_deliveries") {
            return {data:options.priorDelivery ? {id:"synthetic-prior-delivery"} : null,
              error:options.deliveryLookupError ? {message:"PRIVATE_AUDIT_SQL"} : null};
          }
          if (table === "user_roles") {
            roleReads++;
            return {data:options.revokedRole ||
                options.roleRevokedDuringReport && roleReads > 1
                  ? null : {user_id:USER},
              error:options.roleRecheckError && roleReads > 1
                ? {message:"PRIVATE_ROLE"} : null};
          }
          if (table === "school_impact_report_subscriptions") {
            if (selectedColumns.includes("enabled")) {
              return {
                data:options.subscriptionRemovedDuringReport?null:{
                  ...subscription,
                  enabled:!options.subscriptionDisabledDuringReport,
                  email:options.subscriptionEmailChangedDuringReport
                    ?"other@example.invalid":subscription.email,
                  last_sent_month:options.subscriptionMarkedSentDuringReport
                    ?"2026-10":subscription.last_sent_month,
                },
                error:options.subscriptionRecheckError?{message:"PRIVATE_RECHECK_SQL"}:null,
              };
            }
            return {data:options.markerMissing?null:{id:SUB},
              error:options.markerError?{message:"PRIVATE_MARKER_SQL"}:null};
          }
          if (table === "schools") {
            schoolReads++;
            return {
              data:options.missingSchool?null:{id:SCHOOL,
                is_active:!(options.inactiveSchool ||
                  options.schoolDeactivatedDuringReport && schoolReads > 1)},
              error:options.schoolError ||
                  options.schoolRecheckError && schoolReads > 1
                ? {message:"PRIVATE_SCHOOL_SQL"}:null,
            };
          }
          throw Error("Unexpected maybeSingle: "+table);
        },
        insert: () => { events.push("DELIVERY"); return q; },
        update: () => { events.push("UPDATE"); return q; },
        then: (resolve, reject) => (options.deliveryThrows && table==="school_impact_report_deliveries" ? Promise.reject(Error("PRIVATE_THROW_SQL")) : Promise.resolve({error:options.deliveryError && table==="school_impact_report_deliveries"?{message:"PRIVATE_DELIVERY_SQL"}:null})).then(resolve,reject),
      };
      return q;
    },
  };
  const mocks = {
    "@/lib/supabase/admin":{createAdminClient:()=>admin},
    "@/lib/reports/school-impact-cron-subscriptions":{
      loadDueSchoolImpactSubscriptions:async()=> {
        events.push("FROM:school_impact_report_subscriptions");
        if(options.subscriptionError)throw Error("PRIVATE_SUBSCRIPTION_SQL");
        return [subscription];
      },
    },
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

test("missing affected row after email acceptance does not count as a completed report",async()=>{
 const h=fixture({markerMissing:true}),result=await h.run();
 assert.equal(result.body.sent,0);
 assert.equal(result.body.failed,1);
 assert.equal(result.body.ok,false);
 assert.equal(h.events.filter(x=>x==="EMAIL").length,1);
 assert.ok(h.events.includes("MARKER_IS_NULL:null"));
 assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_MARKER_SQL|33333333-3333/);
});
test("sent-marker query error after provider acceptance requires manual reconciliation",async()=>{
 const h=fixture({markerError:true}),result=await h.run();
 assert.equal(result.body.sent,0);
 assert.equal(result.body.failed,1);
 assert.equal(h.events.filter(x=>x==="EMAIL").length,1);
 assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_MARKER_SQL|school@example.invalid/);
});

test("cron freshly checks account, role and school after the PDF but before email",async()=>{
 const h=fixture(),result=await h.run();
 assert.equal(result.body.sent,1);
 assert.equal(h.events.filter(x=>x==="ACCOUNT").length,2);
 assert.equal(h.events.filter(x=>x==="FROM:user_roles").length,2);
 assert.equal(h.events.filter(x=>x==="FROM:schools").length,2);
 const pdfAt=h.events.indexOf("PDF");
 const emailAt=h.events.indexOf("EMAIL");
 assert.ok(pdfAt>=0 && emailAt>pdfAt);
 assert.ok(h.events.lastIndexOf("ACCOUNT")>pdfAt);
 assert.ok(h.events.lastIndexOf("FROM:schools")<emailAt);
});
test("revoked role or deactivated school while report loads prevents cron email",async()=>{
 for(const opts of [{roleRevokedDuringReport:true},{schoolDeactivatedDuringReport:true}]){
  const h=fixture(opts),result=await h.run();
  assert.equal(result.body.sent,0);
  assert.equal(result.body.skipped,1);
  assert.ok(h.events.includes("REPORT"));
  assert.equal(h.events.includes("EMAIL"),false);
  assert.equal(h.events.includes("UPDATE"),false);
 }
});
test("recipient changes or becomes unverified during report generation prevents email",async()=>{
 for(const opts of [{emailChangedDuringReport:true},{unverifiedDuringReport:true}]){
  const h=fixture(opts),result=await h.run();
  assert.equal(result.body.sent,0);
  assert.equal(result.body.skipped,1);
  assert.equal(h.events.includes("EMAIL"),false);
 }
});
test("cron recheck outages never send private PDF and do not leak diagnostics",async()=>{
 for(const opts of [{accountRecheckError:true},{roleRecheckError:true},
   {schoolRecheckError:true}]){
  const h=fixture(opts),result=await h.run();
  assert.equal(result.body.failed,1);
  assert.equal(result.body.sent,0);
  assert.equal(h.events.includes("EMAIL"),false);
  assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_ACCOUNT|PRIVATE_ROLE|PRIVATE_SCHOOL_SQL/);
 }
});

test("postflight disabled, removed, already-sent or redirected subscription blocks email",async()=>{
 for(const cfg of [{subscriptionDisabledDuringReport:true},
  {subscriptionRemovedDuringReport:true},
  {subscriptionMarkedSentDuringReport:true},
  {subscriptionEmailChangedDuringReport:true}]){
  const h=fixture(cfg),out=await h.run();
  assert.equal(out.body.sent,0);
  assert.equal(out.body.skipped,1);
  assert.equal(h.events.includes("EMAIL"),false);
  assert.equal(h.events.includes("UPDATE"),false);
 }
});
test("subscription postflight SQL outage fails closed before provider delivery",async()=>{
 const h=fixture({subscriptionRecheckError:true}),out=await h.run();
 assert.equal(out.body.sent,0);
 assert.equal(out.body.failed,1);
 assert.equal(h.events.includes("EMAIL"),false);
 assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_RECHECK_SQL|school@example.invalid/);
});
test("a valid subscription recheck runs after PDF and before email provider",async()=>{
 const h=fixture(),out=await h.run();
 assert.equal(out.body.sent,1);
 const from=h.events.map((item,i)=>item==="FROM:school_impact_report_subscriptions"?i:-1).filter(i=>i>=0);
 assert.ok(from.length>=3);
 assert.ok(from[1]>h.events.indexOf("PDF"));
 assert.ok(from[1]<h.events.indexOf("EMAIL"));
});

test("cron never resends a private PDF after manual delivery audit committed but marker missed",async()=>{
 const h=fixture({priorDelivery:true}),r=await h.run();
 assert.equal(r.body.sent,0);assert.equal(r.body.skipped,1);
 assert.equal(h.events.includes("EMAIL"),false);
 assert.equal(h.events.includes("DELIVERY"),false);
 assert.equal(h.events.includes("UPDATE"),false);
 assert.ok(h.events.indexOf("FROM:school_impact_report_deliveries")>h.events.indexOf("PDF"));
});
test("cron fails closed if delivery audit is unavailable, without emailing or leaking SQL",async()=>{
 const h=fixture({deliveryLookupError:true}),r=await h.run();
 assert.equal(r.body.failed,1);assert.equal(r.body.sent,0);
 assert.equal(h.events.includes("EMAIL"),false);
 assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_AUDIT_SQL|school@example.invalid/);
});

test("provider accepted but audit INSERT throws: reconciliation counted and no personal diagnostics",async()=>{
 const h=fixture({deliveryThrows:true}),r=await h.run();
 assert.equal(r.body.sent,0);assert.equal(r.body.failed,1);
 assert.equal(r.body.unrecorded,1);assert.equal(r.body.ok,false);
 assert.equal(h.events.filter(x=>x==="EMAIL").length,1);
 assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_THROW_SQL|school@example.invalid|33333333-3333/);
});

test("Auth provider outage on initial recipient lookup is an incident, not a skipped report",async()=>{
 const h=fixture({accountOutage:true}),result=await h.run();
 assert.equal(result.body.ok,false);
 assert.equal(result.body.failed,1);
 assert.equal(result.body.skipped,0);
 assert.equal(result.body.sent,0);
 assert.equal(h.events.includes("REPORT"),false);
 assert.equal(h.events.includes("EMAIL"),false);
 assert.doesNotMatch(JSON.stringify(h.logs),/PRIVATE_ACCOUNT|school@example.invalid/);
});
test("recipient identity mismatch is skipped without privileged report or email",async()=>{
 const h=fixture({wrongUserId:true}),result=await h.run();
 assert.equal(result.body.skipped,1);
 assert.equal(result.body.failed,0);
 assert.equal(h.events.includes("EMAIL"),false);
});
