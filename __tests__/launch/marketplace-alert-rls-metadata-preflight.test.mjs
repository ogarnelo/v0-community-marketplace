import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("scripts/pilot-marketplace-rls-readonly-preflight.sql","utf8");
test("preflight always operates inside a read-only transaction",()=>{
  assert.match(sql,/begin transaction read only;/i);
  assert.match(sql,/commit;/i);
  const statements=sql.replace(/^\\s*--.*$/gm,"");
  assert.doesNotMatch(statements,/^\\s*(?:insert\\s+into|update\\s+public\\.|delete\\s+from|create\\s+table|alter\\s+table|drop\\s+table|grant\\s+|revoke\\s+)\\b/gmi);
});
test("six critical tables require RLS plus direct grant/policy review",()=>{
  for(const table of ["saved_searches","saved_search_matches",
    "user_marketplace_preferences","marketplace_alert_outbox",
    "marketplace_postal_centroids","transactional_email_deliveries"]){
    assert.ok(sql.includes("'"+table+"'"));
  }
  assert.match(sql,/c\.relrowsecurity/);
  assert.match(sql,/pg_policies/);
  assert.match(sql,/has_table_privilege/);
  assert.match(sql,/p\.roles::text\[\]/);
});
test("owner policy preflight includes write WITH CHECK and rejects direct match mutations",()=>{
  assert.match(sql,/p\.with_check ilike/);
  assert.match(sql,/p\.qual ilike/);
  assert.match(sql,/client match write policy/);
  assert.match(sql,/direct client write grant/);
  assert.match(sql,/public email receipt policy/);
});
test("preflight does not read family rows or accidentally activate email",()=>{
  const body=sql.replace(/^--.*$/gm,"");
  assert.doesNotMatch(body,/\bfrom\s+public\.(profiles|messages|conversations|saved_searches|saved_search_matches|listings)\b/i);
  assert.doesNotMatch(body,/resend\.com|sendEmail|cron\.schedule|marketplace_alert_claim_outbox_v1|SUPABASE_SERVICE_ROLE_KEY/);
});

test("policy baseline rejects extra permissive OR policy as well as weakened owner rules",()=>{
  assert.match(sql,/full outer join actual/);
  assert.match(sql,/unexpected or weakened policy/);
  assert.match(sql,/is distinct from a\.cmd/);
  assert.match(sql,/is distinct from a\.roles/);
  assert.match(sql,/is distinct from regexp_replace/);
  const names=[
    "saved_searches_select_authorized",
    "saved_search_matches_select_own",
    "saved_search_matches_delete_own",
    "transactional_email_deliveries_service_role",
    "Users can update own marketplace preferences",
  ];
  for(const name of names)assert.ok(sql.includes(name));
  const regression=readFileSync("scripts/pilot-marketplace-rls-drift-regression.py","utf8");
  for(const attack of ["qa_rogue_select","using (true)",
    "qa_rogue_postal_read","saved_search_matches_delete_own"]){
    assert.ok(regression.includes(attack));
  }
  assert.match(regression,/Refusing any nonlocal or unexpected PostgreSQL URL/);
});
