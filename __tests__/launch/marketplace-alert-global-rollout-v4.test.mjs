import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  savedSearchAlertsEnabled, alertOutboxWorkerEnabled,
} from "../../lib/marketplace/saved-search-alert-rollout.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const matcher=read("app/api/marketplace/listings/match-saved-searches/route.ts");
const worker=read("app/api/cron/marketplace-alert-outbox/route.ts");
const sql=read("scripts/pilot-alerts-pause-v1-proposal.sql");
const config=JSON.parse(read("vercel.json"));
test("guard: absent and values other than literal true fail closed",()=>{
  for(const value of [undefined,"false","TRUE","1","yes"," true ",""]){
    assert.equal(savedSearchAlertsEnabled({WETUDY_SAVED_SEARCH_ALERTS_ENABLED:value}),false);
  }
  assert.equal(savedSearchAlertsEnabled({WETUDY_SAVED_SEARCH_ALERTS_ENABLED:"true"}),true);
});
test("worker: all 27 combinations require triple true",()=>{
  let enabled=0;
  for(const a of [undefined,"false","true"])
  for(const b of [undefined,"false","true"])
  for(const c of [undefined,"false","true"]){
    const actual=alertOutboxWorkerEnabled({
      WETUDY_SAVED_SEARCH_ALERTS_ENABLED:a,
      WETUDY_ALERT_OUTBOX_ENABLED:b,
      WETUDY_ALERT_INTENT_DELIVERY_ENABLED:c,
    });
    const expected=a==="true"&&b==="true"&&c==="true";
    assert.equal(actual,expected);
    enabled+=Number(actual);
  }
  assert.equal(enabled,1);
});
test("worker pause occurs before admin DB writes",()=>{
  const early=matcher.indexOf("if (isOutboxWorker && !savedSearchAlertsEnabled())");
  assert.ok(early>0);
  assert.ok(early<matcher.indexOf("const admin = createAdminClient()"));
  assert.match(matcher,/paused:\s*true,\s*reason:\s*"alerts_disabled"\s*\},\s*\{ status: 202 \}/);
});
test("publisher retains matching and need attribution but suppresses delivery when OFF",()=>{
  const gate=matcher.indexOf("if (!savedSearchAlertsEnabled())");
  assert.ok(gate>matcher.indexOf('from("saved_search_matches")'));
  assert.ok(gate>matcher.indexOf("await recordNeedResult("));
  assert.ok(gate<matcher.indexOf("createNotificationOnce("));
  assert.ok(gate<matcher.indexOf("sendTransactionalEmailOnce("));
  assert.match(matcher,/alertsDisabled:\s*true/);
  assert.match(matcher,/notified:\s*0,\s*emailed:\s*0/);
});
test("cron gate blocks claims unless all three flags are on",()=>{
  assert.ok(worker.indexOf("if (!alertOutboxWorkerEnabled())")>0);
  assert.ok(worker.indexOf("if (!alertOutboxWorkerEnabled())")<worker.indexOf("marketplace_alert_claim_outbox_v1"));
  assert.ok(!config.crons.some(x=>x.path.includes("marketplace-alert-outbox")));
});
test("202 paused is separate from delivery progress",()=>{
  assert.match(worker,/response\.status === 202 && partialProgress/);
  assert.match(worker,/body\?\.paused === true && body\?\.reason === "alerts_disabled"/);
  assert.ok(worker.indexOf("if (alertsPaused)")<worker.indexOf("if (partialProgress)"));
  assert.match(worker,/marketplace_alert_pause_outbox_v1/);
  assert.match(worker,/marketplace_alert_requeue_progress_v1/);
});
test("pause SQL fences lease, requires service_role and preserves prior failure count",()=>{
  assert.match(sql,/SECURITY INVOKER/i);
  assert.match(sql,/SET search_path TO ''/i);
  assert.match(sql,/attempts = greatest\(q\.attempts - 1, 0\)/i);
  assert.match(sql,/q\.lease_token = p_lease_token/);
  assert.match(sql,/q\.lease_until > now\(\)/);
  assert.match(sql,/q\.expires_at > now\(\)/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.marketplace_alert_pause_outbox_v1\(uuid, uuid\) FROM PUBLIC, anon, authenticated/i);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.marketplace_alert_pause_outbox_v1\(uuid, uuid\) TO service_role/i);
});
test("feed continues hiding the seller's full postal code",()=>{
  assert.match(read("app/api/marketplace/feed/route.ts"),/postalCode:\s*null/);
});
