import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const migration=readFileSync("supabase/migrations/20261110231500_marketplace_alert_expired_lease_fencing.sql","utf8");
const fixture=readFileSync("scripts/pilot-marketplace-alert-expired-lease-fencing.sql","utf8");
const ci=readFileSync(".github/workflows/pilot-marketplace-alert-outbox.yml","utf8");
test("each of three state-changing RPCs requires a fresh lease and a live TTL",()=>{
 for(const fn of ["marketplace_alert_settle_outbox_v1","marketplace_alert_requeue_progress_v1","marketplace_alert_defer_readiness_v1"]){
   const a=migration.indexOf("create or replace function public."+fn);
   assert.ok(a>0,fn+" not redefined");
   const next=migration.indexOf("$$;",a);
   const definition=migration.slice(a,next);
   assert.match(definition,/and q\.lease_token\s*=\s*p_lease_token/);
   assert.match(definition,/and q\.lease_until\s*>\s*now\(\)/);
   assert.match(definition,/and q\.expires_at\s*>\s*now\(\)/);
 }
});
test("no public RPC permissions or worker activation introduced",()=>{
 assert.match(migration,/from public,anon,authenticated/);
 assert.match(migration,/to service_role/);
 const body=migration.replace(/^--.*$/gm,"");
 assert.doesNotMatch(body,/recipient_email|postal_code|school_id|email_body/i);
 assert.doesNotMatch(body,/\bcreate trigger\b|\bcron\b/i);
});
test("PostgreSQL fixture includes expired and live leases for all transitions",()=>{
 for(const expected of ["Expired lease settled job","Expired lease requeued progress",
 "Expired lease deferred photo readiness","Valid lease could not settle",
 "Valid lease could not requeue progress","Valid lease could not defer readiness",
 "Expired TTL settled despite live lease"]) assert.ok(fixture.includes(expected));
 assert.match(ci,/pilot-marketplace-alert-expired-lease-fencing\.sql/);
 assert.match(ci,/127\.0\.0\.1/);
});
