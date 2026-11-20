import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const read=path=>readFileSync(path,"utf8");
const workflow=read(".github/workflows/pilot-anon-select-next-browser-local.yml");
const fixture=read("scripts/pilot-anon-select-next-browser-local-fixture.sql");
const browser=read("scripts/pilot-anon-select-next-browser-local-e2e.cjs");
const critical=read(".github/workflows/contracts.yml");
const names=["agreements","demand_requests","profiles","saved_searches","schools"];

test("full Next/Chromium Supabase browser E2E has zero hosted service credentials",()=>{
  assert.match(workflow,/on:\s*\n\s*pull_request:/);
  assert.match(workflow,/permissions:\s*\n\s*contents: read/);
  assert.match(workflow,/persist-credentials:\s*false/);
  assert.match(workflow,/supabase@2\.121\.0/);
  assert.match(workflow,/next@16\.3\.5/);
  assert.match(workflow,/playwright@1\.65\.0/);
  assert.match(workflow,/127\.0\.0\.1:54322\/postgres/);
  assert.match(workflow,/supabase\/config\.toml/);
  assert.match(workflow,/stop --no-backup/);
  assert.match(browser,/Only disposable loopback Supabase CLI Auth\/PostgREST\/DB permitted/);
  assert.match(browser,/wetudy_disposable_next_browser_20261120/);
  assert.match(fixture,/current_setting\('application_name'\)/);
  assert.match(fixture,/Refuse non-disposable Supabase CLI Next browser fixture/);
  assert.doesNotMatch(workflow+browser+fixture,/\.supabase\.co|https:\/\/(?:www\.)?wetudy\.com/i);
  assert.doesNotMatch(workflow+browser,/SUPABASE_ACCESS_TOKEN|DATABASE_URL|SUPABASE_DB_URL/);
  assert.match(critical,/pilot-anon-next-browser-local-closure\.test\.mjs/);
});

test("authentic production Next API routes and Supabase SSR/browser clients are copied unchanged",()=>{
  for(const file of [
    "app/api/schools/public/route.ts",
    "app/api/marketplace/feed/route.ts",
    "lib/supabase/server.ts",
    "lib/supabase/client.ts",
    "lib/supabase/admin.ts",
    "lib/supabase/proxy.ts",
    "proxy.ts",
    "lib/marketplace/feed-filters.ts",
    "lib/marketplace/postal-distance.ts",
    "lib/types/marketplace.ts"
  ]) assert.ok(browser.includes('"'+file+'"'),"Missing original route or client "+file);
  assert.match(browser,/new URL\(api\)\.hostname/);
  assert.match(browser,/chromium\.launch\(\{headless:true\}\)/);
  assert.match(browser,/__qaLogin/);
  assert.match(browser,/__qaRead/);
  assert.match(browser,/__qaHttp/);
  assert.match(browser,/context\.cookies\(origin\)/);
});

test("five-table privileges and RLS remain strict before and after real local revoke",()=>{
  for(const name of names){
    assert.ok(fixture.includes("public."+name),"Missing SQL fixture table "+name);
    assert.ok(fixture.includes("ALTER TABLE public."+name+" ENABLE ROW LEVEL SECURITY"),
      "Missing RLS "+name);
    assert.ok(browser.includes('"'+name+'"'),"Missing JS target table "+name);
  }
  assert.match(browser,/REVOKE SELECT ON public\.agreements,public\.demand_requests,public\.profiles,/);
  assert.match(browser,/public\.saved_searches,public\.schools FROM anon/);
  assert.match(browser,/has_table_privilege\('anon'/);
  assert.match(browser,/has_table_privilege\('authenticated'/);
  assert.match(browser,/has_table_privilege\('service_role'/);
  assert.match(browser,/Guest must lose/);
  assert.match(browser,/assert\.deepEqual\(publicAfter,publicBefore/);
  assert.match(browser,/assert\.deepEqual\(agreements\.data\.map\(a=>a\.id\),allow\?\[agreementId\]:\[\]\)/);
  assert.match(browser,/assert\.equal\(profile\.error,null/);
  assert.match(browser,/assert\.equal\(list\.status,200/);
  assert.match(browser,/assert\.equal\(feed\.status,200/);
  assert.match(browser,/assert\.equal\(distance\.status,401/);
  assert.match(browser,/app\/account\/saved-searches\/page\.tsx/);
  assert.match(browser,/privateFamilyPages\(guest,b,s,o\)/);
  assert.match(browser,/assert\.deepEqual\(familyAfter,familyBefore/);
  assert.match(browser,/function restoreOnlyLocally\(\)/);
  assert.match(browser,/Refuse rollback outside explicitly labeled disposable local Supabase CLI/);
  assert.match(browser,/rollback in local-only fixture/);
  assert.match(browser,/assert\.deepEqual\(publicRestored,publicBefore/);
  assert.match(browser,/assert\.deepEqual\(familyRestored,familyBefore/);
  assert.match(browser,/assert\.deepEqual\(familyRestored,familyAfter/);
  assert.match(browser,/await guestReads\(guest,false\)/);
  assert.match(browser,/200\/empty -> 42501 -> 200\/empty/);
  assert.match(browser,/waitForURL\(u=>u\.pathname==="\/auth"/);
  assert.match(browser,/Cross-account saved-search leak/);
  assert.match(browser,/PRIVADA_BUYER_LIBROS/);
  assert.match(browser,/PRIVADA_SELLER_MATERIAL/);
  assert.match(browser,/LIBRO QA DE SEGUNDA MANO/);
  assert.match(fixture,/CREATE TABLE public\.saved_search_matches/);
  assert.match(fixture,/wetudy_local_search_matches_self/);
  assert.match(workflow,/lucide-react@0\.468\.0/);
  assert.match(browser,/LOCAL DB|local CLI QA|Only disposable loopback/);
});

test("local Next QA fixture is source-file test, never a production migration",()=>{
  assert.match(workflow,/WETUDY_ANON_NEXT_FIXTURE: \/tmp\//);
  assert.match(browser,/fs\.copyFileSync\(path\.join\(root,relative\),dest\)/);
  assert.doesNotMatch(workflow,/apply_migration|supabase db push|supabase migration up/);
  assert.doesNotMatch(workflow,/SUPABASE_SERVICE_ROLE_KEY:\s*["']?[A-Za-z0-9._-]{30,}/);
  const result=spawnSync(process.execPath,["--check","scripts/pilot-anon-select-next-browser-local-e2e.cjs"],
    {encoding:"utf8",timeout:8000});
  assert.equal(result.status,0,result.stderr);
});
