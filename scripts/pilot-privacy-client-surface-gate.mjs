#!/usr/bin/env node
// WETUDY pilot privacy release gate. Offline source inspection; no credentials.
// This gate complements, but DOES NOT replace, Data API and HTTP tests with real QA roles.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const read=(p)=>readFileSync(p,"utf8");
let pass=0;
function check(name, fn){try{fn();pass++;console.log("PASS "+name)}catch(e){console.error("BLOCK "+name+": "+e.message);process.exitCode=2}}
const homepage=read("app/marketplace/page.tsx");
const feed=read("app/api/marketplace/feed/route.ts");
const school=read("app/api/marketplace/my-school/route.ts");
const detail=read("app/marketplace/listing/[id]/page.tsx");
const sitemap=read("app/sitemap.ts");
const authProposal=read("scripts/pilot-auth-listings-sensitive-grants-proposal.sql");
const anonProposal=read("scripts/pilot-anon-listings-revoke-proposal.sql");
check("public home and feed use service-side listing reads",()=>{
  assert.match(homepage,/const admin = createAdminClient\(\)/);
  assert.match(homepage,/await admin[\s\S]*?\.from\("listings"\)/);
  assert.doesNotMatch(homepage,/supabase\.from\("listings"\)/);
  assert.match(feed,/admin\.from\("listings"\)\.select\(FIELDS\)\.eq\("status", "available"\)/);
  assert.doesNotMatch(feed,/supabase\.from\("listings"\)/);
});
check("all service-role public listing reads restrict to available",()=>{
  assert.match(homepage,/\.eq\("status", "available"\)/);
  assert.match(feed,/\.eq\("status", "available"\)/);
  assert.match(detail,/listing\.status !== "available"/);
  assert.match(detail,/if \(!isAvailable && !isOwnListing\)/);
  assert.match(sitemap,/\.eq\("status", "available"\)/);
});
check("school feed derives the scope from verified session before bypass reads",()=>{
  const auth=school.indexOf("if (authError || !user)");
  const scope=school.indexOf("const expression = makeMarketplaceSchoolFilter");
  const admin=school.indexOf("const admin = createAdminClient()");
  const query=school.indexOf('admin.from("listings")');
  assert.ok(auth>=0&&scope>auth&&admin>scope&&query>admin);
  assert.match(school,/if \(!expression\)\s*\{/);
  assert.match(school,/\.eq\("status", "available"\)/);
});
check("distance stays server-computed and postcode never reaches card payloads",()=>{
  for(const s of [homepage,feed,school])assert.match(s,/postalCode: null, \/\//);
  assert.match(feed,/hasKnownPostalCode\(viewerPostalCode\)/);
  assert.match(feed,/p_postal_code: viewerPostalCode/);
  assert.match(feed,/const PAGE_SIZE = 60/);
  assert.match(feed,/\.range\(offset, offset \+ PAGE_SIZE\)/);
});
check("anon and authenticated SELECT proposals remove tablewide grants",()=>{
  assert.match(anonProposal,/REVOKE SELECT ON TABLE public\.listings FROM anon/);
  assert.match(authProposal,/REVOKE SELECT ON TABLE public\.listings FROM authenticated/);
  const grant=authProposal.match(/GRANT SELECT \(([^)]+)\)/);
  assert.ok(grant);
  const cols=grant[1].split(",").map(x=>x.trim());
  assert.equal(cols.length,33);
  for(const bad of ["postal_code","lat","lng"])assert.ok(!cols.includes(bad));
  for(const needed of ["id","seller_id","status","directory_school_code","is_demo"])
    assert.ok(cols.includes(needed));
});
check("client listing SELECT does not request wildcard or precise seller location",()=>{
  const paths=execFileSync("git",["ls-files","--","components","app"],{encoding:"utf8"}).trim().split("\n")
    .filter(p=>/\.(tsx|ts|jsx|js)$/.test(p));
  let count=0;
  for(const p of paths){
    if(!p.startsWith("components/"))continue; // Browser-facing components, not server routes.
    const src=read(p);
    const select=/\.from\(\s*["']listings["']\s*\)\s*\.select\(\s*["'`]([^"'`]+)["'`]/g;
    for(const match of src.matchAll(select)){
      count++;
      assert.notEqual(match[1].trim(),"*",p+" uses SELECT *");
      assert.doesNotMatch(match[1],/(^|,)\s*(postal_code|lat|lng)\s*(,|$)/,p+" reads exact seller location");
    }
  }
  assert.ok(count>=2,"Expected browser message/contact listing reads");
});
console.log(pass+"/6 static privacy gates. Full auth, API, school-scope E2E remain mandatory.");
