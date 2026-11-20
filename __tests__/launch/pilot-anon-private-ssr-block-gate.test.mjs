import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const file=p=>readFileSync(p,"utf8");
const family=file("scripts/pilot-anon-select-next-browser-local-e2e.cjs");
const familySql=file("scripts/pilot-anon-select-next-browser-local-fixture.sql");
const admin=file("scripts/pilot-three-ampa-real-next-browser.cjs");
const adminSql=file("scripts/pilot-three-ampa-next-real-fixture.sql");
const adminWorkflow=file(".github/workflows/pilot-three-ampa-real-next-browser.yml");
const familyWorkflow=file(".github/workflows/pilot-anon-select-next-browser-local.yml");
const critical=file(".github/workflows/contracts.yml");
const targets=["agreements","demand_requests","profiles","saved_searches","schools"];

test("actual family SavedSearchesPage SSR loads protected matches before/after real anon revoke",()=>{
  assert.match(family,/app\/account\/saved-searches\/page\.tsx/);
  assert.match(family,/privateFamilyPages\(guest,b,s,o\)/);
  assert.match(family,/assert\.deepEqual\(familyAfter,familyBefore/);
  assert.match(family,/page\.goto\(origin\+"\/account\/saved-searches"/);
  assert.match(family,/private-saved-searches/);
  assert.match(family,/private-matched-listings/);
  assert.match(family,/getByRole\("heading",\{name:"Mis búsquedas"\}\)/);
  assert.match(family,/waitForURL\(u=>u\.pathname==="\/auth"/);
  assert.match(family,/Cross-account saved-search leak/);
  assert.match(familySql,/CREATE TABLE public\.saved_search_matches/);
  assert.match(familySql,/POLICY wetudy_local_search_matches_self/);
  assert.match(familySql,/FOR SELECT TO authenticated/);
  assert.match(familyWorkflow,/playwright@1\.65\.0/);
  assert.match(familyWorkflow,/lucide-react@0\.468\.0/);
  assert.match(familyWorkflow,/127\.0\.0\.1:54322\/postgres/);
});

test("real three-school AMPA SSR page retains isolation and group authorization after local revoke",()=>{
  assert.match(admin,/app\/admin\/school\/page\.tsx/);
  assert.match(admin,/await page\.reload\(\{waitUntil:"domcontentloaded"\}\)/);
  assert.match(admin,/getByTestId\("school-title"\)/);
  assert.match(admin,/getByTestId\("member-count"\)/);
  assert.match(admin,/Anonymous grant revoke changed private multi-school isolation/);
  assert.match(admin,/for\(const actor of \[noRole,guest\]\)/);
  assert.match(admin,/REVOKE SELECT ON public\.agreements,public\.demand_requests,public\.profiles,/);
  assert.match(admin,/public\.saved_searches,public\.schools FROM anon/);
  assert.match(admin,/has_table_privilege\('anon'/);
  assert.match(admin,/has_table_privilege\('authenticated'/);
  assert.match(admin,/has_table_privilege\('service_role'/);
  assert.match(admin,/f\|t\|t/);
  assert.match(admin,/wetudy_ampa_private_anon_revoke_local_20261120/);
  assert.match(adminSql,/Refuse private-school QA outside designated local stack/);
  assert.match(adminWorkflow,/PGAPPNAME: wetudy_ampa_private_anon_revoke_local_20261120/);
  assert.match(adminWorkflow,/supabase@2\.121\.0/);
  assert.match(adminWorkflow,/next@16\.3\.5/);
  assert.match(adminWorkflow,/playwright@1\.65\.0/);
});

test("five-table anon grants start present and are revoked ONLY in localhost fixtures",()=>{
  for(const table of targets){
    assert.match(familySql,new RegExp("ALTER TABLE public\\."+table+" ENABLE ROW LEVEL SECURITY"));
    assert.match(adminSql,new RegExp("ALTER TABLE public\\."+table+" ENABLE ROW LEVEL SECURITY"));
    assert.match(adminSql,new RegExp("public\\."+table+"(?:,| TO|\\n|\\r)"));
  }
  assert.match(adminSql,/TO anon,authenticated/);
  assert.match(adminSql,/qa_profile_self ON public\.profiles FOR SELECT TO authenticated/);
  assert.match(adminSql,/qa_search_self ON public\.saved_searches FOR SELECT TO authenticated/);
  assert.match(adminSql,/qa_demand_self ON public\.demand_requests FOR SELECT TO authenticated/);
  assert.match(adminSql,/qa_agreement_participants ON public\.agreements FOR SELECT TO authenticated/);
  assert.match(family,/Only disposable loopback Supabase CLI Auth\/PostgREST\/DB permitted/);
  assert.match(admin,/Refusing nonlocal or unexpected private-school Supabase test database/);
  assert.doesNotMatch(adminWorkflow+familyWorkflow, /\.supabase\.co|https:\/\/(?:www\.)?wetudy\.com/);
  assert.doesNotMatch(adminWorkflow+familyWorkflow,/SUPABASE_DB_URL|SUPABASE_ACCESS_TOKEN/);
  for(const p of [
    "scripts/pilot-anon-select-next-browser-local-e2e.cjs",
    "scripts/pilot-three-ampa-real-next-browser.cjs"
  ]){
    const out=spawnSync(process.execPath,["--check",p],{encoding:"utf8",timeout:8000});
    assert.equal(out.status,0,p+": "+out.stderr);
  }
});

test("critical CI prevents removing the private-page browser tests",()=>{
  assert.match(critical,/pilot-anon-private-ssr-block-gate\.test\.mjs/);
  assert.match(adminWorkflow,/scripts\/pilot-three-ampa-real-next-browser\.cjs/);
  assert.match(familyWorkflow,/scripts\/pilot-anon-select-next-browser-local-e2e\.cjs/);
});
